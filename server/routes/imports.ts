import { ClientError, forgeRouter } from '@lifeforge/server-utils'
import fs from 'fs/promises'
import z from 'zod'

import forge from '../forge'
import {
  BATCH_STATUS_LIMIT,
  COLLECTION_NAMES,
  IMPORT_TEXT_MAX_LENGTH
} from '../utils/constants'
import {
  asNumber,
  asStringArray,
  ensureAuthenticatedUser,
  normalizeIncomingPaper,
  pickString
} from '../utils/records'

type PocketBase = any
type RecordLike = Record<string, unknown>
type UploadFile = {
  path: string
  originalname?: string
}

function formatRecordError(error: unknown) {
  if (!isRecord(error)) {
    return error instanceof Error ? error.message : String(error)
  }

  const message =
    typeof error.message === 'string' && error.message.trim()
      ? error.message.trim()
      : 'Failed to create record.'

  const responseData = isRecord(error.response)
    ? error.response.data
    : isRecord(error.data)
      ? error.data
      : undefined

  if (!isRecord(responseData)) {
    return message
  }

  const fieldErrors = Object.entries(responseData)
    .map(([field, value]) => {
      if (isRecord(value) && typeof value.message === 'string') {
        return `${field}: ${value.message}`
      }

      return undefined
    })
    .filter((value): value is string => !!value)

  return fieldErrors.length > 0
    ? `${message} (${fieldErrors.join('; ')})`
    : message
}

function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readImportContent(
  file: UploadFile | string | undefined,
  content?: string
) {
  if (content?.trim()) {
    return content
  }

  if (file && typeof file !== 'string' && file.path) {
    return fs.readFile(file.path, 'utf8')
  }

  throw new ClientError('Select a file or paste JSON content first', 400)
}

function parseJsonImport(content: string) {
  const parsed = JSON.parse(content) as unknown

  if (Array.isArray(parsed)) return parsed
  if (isRecord(parsed) && Array.isArray(parsed.papers)) return parsed.papers
  if (isRecord(parsed) && Array.isArray(parsed.items)) return parsed.items

  throw new ClientError('JSON content must be an array or an object with a papers/items array', 400)
}

function parseJsonlImport(content: string) {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch {
        throw new ClientError(`Invalid JSONL at line ${index + 1}`, 400)
      }
    })
}

function extractImportOverlay(paper: unknown) {
  if (!isRecord(paper)) {
    return {
      matchedCollections: [] as string[],
      score: undefined as number | undefined,
      tldr: undefined as string | undefined,
      translatedTitle: undefined as string | undefined,
      translatedAbstract: undefined as string | undefined,
      warnings: [] as string[]
    }
  }

  const ai = isRecord(paper.AI)
    ? paper.AI
    : isRecord(paper.ai)
      ? paper.ai
      : {}

  const warnings: string[] = []
  const truncateOverlayText = (
    fieldName: 'tldr' | 'translated_title' | 'translated_abstract',
    value: string | undefined
  ) => {
    if (!value) return undefined
    if (value.length <= IMPORT_TEXT_MAX_LENGTH) return value

    warnings.push(
      `${fieldName} truncated from ${value.length} to ${IMPORT_TEXT_MAX_LENGTH} characters`
    )

    return value.slice(0, IMPORT_TEXT_MAX_LENGTH).trimEnd()
  }

  return {
    matchedCollections: asStringArray(
      paper.collections ?? paper.collection ?? ai.collections ?? ai.collection
    ),
    score: isRecord(paper.score)
      ? asNumber(paper.score.max)
      : asNumber(paper.score),
    tldr: truncateOverlayText('tldr', pickString(ai.tldr, paper.tldr, paper.TLDR)),
    translatedTitle: truncateOverlayText(
      'translated_title',
      pickString(
        ai.translated_title,
        ai.title_translated,
        paper.translated_title,
        paper.title_translated
      )
    ),
    translatedAbstract: truncateOverlayText(
      'translated_abstract',
      pickString(
        ai.translated_abstract,
        ai.summary_translated,
        paper.translated_abstract,
        paper.summary_translated
      )
    ),
    warnings
  }
}

function compactUpdate(data: RecordLike) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  )
}

async function upsertPaper(pb: PocketBase, rawPaper: unknown, source?: string) {
  const normalized = normalizeIncomingPaper(rawPaper, { source })

  if (!normalized) {
    return null
  }

  const existing = await pb.instance
    .collection(COLLECTION_NAMES.papers)
    .getFirstListItem(
      pb.instance.filter('fingerprint = {:fingerprint}', {
        fingerprint: normalized.fingerprint
      })
    )
    .catch(() => null)

  const now = new Date().toISOString()
  const payload = {
    external_id: normalized.externalId,
    fingerprint: normalized.fingerprint,
    title: normalized.title,
    authors: normalized.authors,
    abstract: normalized.abstract,
    journal: normalized.journal,
    source: normalized.source,
    published_at: normalized.publishedAt,
    doi: normalized.doi,
    url: normalized.url,
    pdf_url: normalized.pdfUrl,
    keywords: normalized.keywords,
    raw_payload: normalized.rawPayload,
    abstract_status: normalized.abstractStatus,
    last_seen_at: now
  }

  const overlay = extractImportOverlay(rawPaper)

  if (existing) {
    return {
      paperId: String(existing.id),
      operation: 'skipped' as const,
      overlay,
      warnings: [...normalized.warnings, ...overlay.warnings],
      skippedReason: 'duplicate_fingerprint'
    }
  }

  const created = await pb.instance.collection(COLLECTION_NAMES.papers).create({
    ...payload,
    fetched_at: now
  })

  return {
    paperId: String(created.id),
    operation: 'inserted' as const,
    overlay,
    warnings: [...normalized.warnings, ...overlay.warnings]
  }
}

async function upsertUserState(
  pb: PocketBase,
  userId: string,
  paperId: string,
  overlay: ReturnType<typeof extractImportOverlay>
) {
  const state = await pb.instance
    .collection(COLLECTION_NAMES.userPaperStates)
    .getFirstListItem(
      pb.instance.filter('user = {:user} && paper = {:paper}', {
        user: userId,
        paper: paperId
      })
    )
    .catch(() => null)

  const now = new Date().toISOString()
  const recommendComplete =
    overlay.score !== undefined || overlay.matchedCollections.length > 0
  const enhanceComplete =
    !!overlay.tldr || !!overlay.translatedTitle || !!overlay.translatedAbstract

  const payload = compactUpdate({
    user: userId,
    paper: paperId,
    score_max: overlay.score,
    score_breakdown:
      overlay.score !== undefined ? { imported: overlay.score } : undefined,
    matched_collections:
      overlay.matchedCollections.length > 0 ? overlay.matchedCollections : undefined,
    tldr: overlay.tldr,
    translated_title: overlay.translatedTitle,
    translated_abstract: overlay.translatedAbstract,
    recommend_status: recommendComplete ? 'completed' : 'idle',
    enhance_status: enhanceComplete ? 'completed' : 'idle',
    recommend_last_reason: '',
    enhance_last_reason: '',
    recommended_at: recommendComplete ? now : undefined,
    enhanced_at: enhanceComplete ? now : undefined
  })

  if (!state) {
    await pb.instance.collection(COLLECTION_NAMES.userPaperStates).create(payload)
    return
  }

  await pb.instance.collection(COLLECTION_NAMES.userPaperStates).update(state.id, payload)
}

async function ingestPapers(params: {
  pb: PocketBase
  userId: string
  papers: unknown[]
  type: 'json' | 'jsonl'
  source?: string
  filename?: string
}) {
  const { pb, userId, papers, type, source, filename } = params

  const batch = await pb.instance.collection(COLLECTION_NAMES.importBatches).create({
    user: userId,
    type,
    source,
    filename,
    status: 'running',
    total: papers.length,
    inserted: 0,
    updated_count: 0,
    skipped: 0,
    failed: 0,
    error_log: ''
  })

  let inserted = 0
  let updated = 0
  let skipped = 0
  let failed = 0
  const errors: string[] = []
  const warnings: string[] = []

  for (const [index, rawPaper] of papers.entries()) {
    try {
      const result = await upsertPaper(pb, rawPaper, source)

      if (!result) {
        skipped += 1
        errors.push(`Item ${index + 1}: skipped because it could not be normalized.`)
        continue
      }

      if (result.operation === 'inserted') inserted += 1
      if (result.operation === 'skipped') {
        skipped += 1
        warnings.push(
          `Item ${index + 1}: skipped duplicate paper (${result.skippedReason ?? 'duplicate'})`
        )
        continue
      }

      await upsertUserState(pb, userId, result.paperId, result.overlay)

      if (result.warnings.length > 0) {
        warnings.push(
          ...result.warnings.map(message => `Item ${index + 1}: Warning: ${message}`)
        )
      }
    } catch (error) {
      failed += 1
      errors.push(
        `Item ${index + 1}: ${formatRecordError(error)}`
      )
    }
  }

  await pb.instance.collection(COLLECTION_NAMES.importBatches).update(batch.id, {
    status: inserted > 0 || updated > 0 || skipped > 0 ? 'completed' : 'failed',
    inserted,
    updated_count: updated,
    skipped,
    failed,
    error_log: [...warnings, ...errors].join('\n').slice(0, 60000)
  })

  return {
    batchId: String(batch.id),
    inserted,
    updated,
    skipped,
    failed
  }
}

const json = forge
  .mutation()
  .description('Import papers from JSON content or file')
  .input({
    body: z.object({
      content: z.string().optional(),
      source: z.string().optional()
    })
  })
  .media({
    file: {
      optional: true
    }
  })
  .callback(async ({ pb, body, media: { file } }) => {
    const userId = ensureAuthenticatedUser(pb.instance)
    const content = await readImportContent(file, body.content)
    const papers = parseJsonImport(content)

    return ingestPapers({
      pb,
      userId,
      papers,
      type: 'json',
      source: body.source,
      filename: typeof file === 'string' ? undefined : file?.originalname
    })
  })

const jsonl = forge
  .mutation()
  .description('Import papers from JSONL content or file')
  .input({
    body: z.object({
      content: z.string().optional(),
      source: z.string().optional()
    })
  })
  .media({
    file: {
      optional: true
    }
  })
  .callback(async ({ pb, body, media: { file } }) => {
    const userId = ensureAuthenticatedUser(pb.instance)
    const content = await readImportContent(file, body.content)
    const papers = parseJsonlImport(content)

    return ingestPapers({
      pb,
      userId,
      papers,
      type: 'jsonl',
      source: body.source,
      filename: typeof file === 'string' ? undefined : file?.originalname
    })
  })

const batchStatus = forge
  .query()
  .description('List the latest import batches for the current user')
  .input({})
  .callback(async ({ pb }) => {
    const userId = ensureAuthenticatedUser(pb.instance)
    const batches = await pb.instance.collection(COLLECTION_NAMES.importBatches).getFullList({
      filter: pb.instance.filter('user = {:user}', {
        user: userId
      }),
      sort: '-created'
    })

    return batches.slice(0, BATCH_STATUS_LIMIT).map((batch: RecordLike) => ({
      id: String(batch.id),
      type: String(batch.type),
      source: pickString(batch.source) ?? '',
      filename: pickString(batch.filename) ?? '',
      status: String(batch.status),
      total: asNumber(batch.total) ?? 0,
      inserted: asNumber(batch.inserted) ?? 0,
      updatedCount: asNumber(batch.updated_count) ?? 0,
      skipped: asNumber(batch.skipped) ?? 0,
      failed: asNumber(batch.failed) ?? 0,
      errorLog: pickString(batch.error_log) ?? '',
      created: String(batch.created)
    }))
  })

export default forgeRouter({
  json,
  jsonl,
  batchStatus
})
