import { ClientError } from '@lifeforge/server-utils'
import dayjs from 'dayjs'
import fs from 'fs/promises'
import { createHash } from 'node:crypto'

import { COLLECTION_NAMES, DEFAULT_FOLDER_NAME } from './constants'

export interface PaperListItem {
  id: string
  title: string
  translatedTitle?: string
  authors: string[]
  journal?: string
  source?: string
  publishedAt?: string
  doi?: string
  url?: string
  pdfUrl?: string
  collections: string[]
  keywords: string[]
  score?: number
  tldr?: string
  isFavorite: boolean
  favoriteFolderId?: string
}

export interface PaperDetail extends PaperListItem {
  abstract?: string
  translatedAbstract?: string
  rawPayload?: unknown
}

export interface PaperListQuery {
  query?: string
  dateFrom?: string
  dateTo?: string
  sources: string[]
  journals: string[]
  collections: string[]
  favoritesOnly: boolean
  hasAbstractOnly: boolean
  sort: 'published_desc' | 'score_desc'
}

export interface ImportSummary {
  batchId: string
  inserted: number
  updated: number
  skipped: number
  failed: number
}

interface NormalizedPaper {
  title: string
  translatedTitle?: string
  authors: string[]
  abstract?: string
  translatedAbstract?: string
  tldr?: string
  journal?: string
  source?: string
  publishedAt?: string
  doi?: string
  url?: string
  pdfUrl?: string
  collections: string[]
  keywords: string[]
  score?: number
  externalId?: string
  fingerprint: string
  rawPayload: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()

  if (!trimmed) return undefined

  if (['skip', 'error', 'n/a', 'none', 'null'].includes(trimmed.toLowerCase())) {
    return undefined
  }

  return trimmed
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const normalized = asNonEmptyString(value)

    if (normalized) return normalized
  }

  return undefined
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap(item => {
        if (typeof item === 'string') return [item]
        if (isRecord(item)) {
          return [
            pickString(item.name, item.label, item.title, item.value) ?? ''
          ]
        }

        return []
      })
      .map(item => item.trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(/[,;|\n]/)
      .map(item => item.trim())
      .filter(Boolean)
  }

  return []
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function asDateString(value: unknown): string | undefined {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    return undefined
  }

  const parsed = dayjs(value)

  if (!parsed.isValid()) return undefined

  return parsed.toISOString()
}

function normalizeScore(value: unknown): number | undefined {
  if (isRecord(value)) {
    return asNumber(value.max)
  }

  return asNumber(value)
}

function buildFingerprint(input: {
  doi?: string
  externalId?: string
  title: string
  publishedAt?: string
  source?: string
}) {
  const base =
    input.doi?.toLowerCase() ||
    input.externalId?.toLowerCase() ||
    [input.title, input.publishedAt ?? '', input.source ?? '']
      .join('::')
      .toLowerCase()

  return createHash('sha1').update(base).digest('hex')
}

export function normalizeIncomingPaper(
  paper: unknown,
  options?: {
    source?: string
  }
): NormalizedPaper | null {
  if (!isRecord(paper)) return null

  const ai = isRecord(paper.AI)
    ? paper.AI
    : isRecord(paper.ai)
      ? paper.ai
      : {}

  const title = pickString(paper.title, paper.paper_title, paper.name)

  const abstract = pickString(
    paper.summary,
    paper.abstract,
    paper.description,
    paper.content
  )

  const translatedTitle = pickString(
    ai.title_translated,
    ai.translated_title,
    paper.translated_title,
    paper.title_translated
  )

  const translatedAbstract = pickString(
    ai.summary_translated,
    ai.translated_abstract,
    paper.translated_abstract,
    paper.summary_translated
  )

  const tldr = pickString(ai.tldr, paper.tldr, paper.TLDR)

  if (!title && !abstract && !tldr) {
    return null
  }

  const authors = asStringArray(paper.authors)
  const collections = asStringArray(paper.collection ?? paper.collections)
  const keywords = asStringArray(
    ai.keywords ?? paper.keywords ?? paper.tags ?? paper.topics
  )

  const publishedAt = asDateString(
    paper.published_at ?? paper.published ?? paper.date ?? paper.fileDate
  )

  const externalId = pickString(
    paper.external_id,
    paper.id,
    paper.abs,
    paper.url,
    paper.pdf,
    paper.doi
  )

  const normalized: NormalizedPaper = {
    title: title ?? translatedTitle ?? 'Untitled paper',
    translatedTitle,
    authors,
    abstract,
    translatedAbstract,
    tldr,
    journal: pickString(paper.journal, paper.publication, paper.venue),
    source: pickString(paper.source, options?.source),
    publishedAt,
    doi: pickString(paper.doi),
    url: pickString(paper.abs, paper.url, paper.link),
    pdfUrl: pickString(paper.pdf, paper.pdf_url),
    collections,
    keywords,
    score: normalizeScore(paper.score),
    externalId,
    fingerprint: buildFingerprint({
      doi: pickString(paper.doi),
      externalId,
      title: title ?? translatedTitle ?? 'Untitled paper',
      publishedAt,
      source: pickString(paper.source, options?.source)
    }),
    rawPayload: paper
  }

  return normalized
}

function compactUpdate<T extends Record<string, unknown>>(data: T) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => {
      if (value === undefined || value === null) return false
      if (typeof value === 'string') return value.trim() !== ''
      if (Array.isArray(value)) return value.length > 0

      return true
    })
  )
}

function mapPaperRecord(
  record: Record<string, unknown>,
  favoriteFolderId?: string
): PaperListItem {
  return {
    id: String(record.id),
    title: pickString(record.title) ?? 'Untitled paper',
    translatedTitle: pickString(record.translated_title),
    authors: asStringArray(record.authors),
    journal: pickString(record.journal),
    source: pickString(record.source),
    publishedAt: pickString(record.published_at),
    doi: pickString(record.doi),
    url: pickString(record.url),
    pdfUrl: pickString(record.pdf_url),
    collections: asStringArray(record.collections),
    keywords: asStringArray(record.keywords),
    score: asNumber(record.score),
    tldr: pickString(record.tldr),
    isFavorite: favoriteFolderId !== undefined,
    favoriteFolderId
  }
}

export function mapPaperDetail(
  record: Record<string, unknown>,
  favoriteFolderId?: string
): PaperDetail {
  return {
    ...mapPaperRecord(record, favoriteFolderId),
    abstract: pickString(record.abstract),
    translatedAbstract: pickString(record.translated_abstract),
    rawPayload: record.raw_payload
  }
}

function matchesSearch(paper: PaperListItem, rawRecord: Record<string, unknown>, query: string) {
  const lowered = query.toLowerCase()

  return [
    paper.title,
    paper.translatedTitle,
    ...paper.authors,
    paper.journal,
    paper.source,
    ...paper.collections,
    ...paper.keywords,
    paper.tldr,
    pickString(rawRecord.abstract),
    pickString(rawRecord.translated_abstract)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(lowered)
}

export function applyPaperFilters(
  records: Record<string, unknown>[],
  favoriteFolderMap: Map<string, string>,
  filters: PaperListQuery
) {
  const filtered = records
    .map(record => ({
      record,
      paper: mapPaperRecord(record, favoriteFolderMap.get(String(record.id)))
    }))
    .filter(({ paper, record }) => {
      if (filters.favoritesOnly && !paper.isFavorite) return false

      if (
        filters.hasAbstractOnly &&
        !paper.tldr &&
        !pickString(record.abstract) &&
        !pickString(record.translated_abstract)
      ) {
        return false
      }

      if (filters.sources.length > 0 && !filters.sources.includes(paper.source ?? '')) {
        return false
      }

      if (
        filters.journals.length > 0 &&
        !filters.journals.includes(paper.journal ?? '')
      ) {
        return false
      }

      if (
        filters.collections.length > 0 &&
        !filters.collections.some(collection =>
          paper.collections.includes(collection)
        )
      ) {
        return false
      }

      if (filters.dateFrom || filters.dateTo) {
        const published = paper.publishedAt ? dayjs(paper.publishedAt) : null

        if (!published?.isValid()) return false

        if (filters.dateFrom && published.isBefore(dayjs(filters.dateFrom), 'day')) {
          return false
        }

        if (filters.dateTo && published.isAfter(dayjs(filters.dateTo), 'day')) {
          return false
        }
      }

      if (filters.query && !matchesSearch(paper, record, filters.query)) {
        return false
      }

      return true
    })

  filtered.sort((left, right) => {
    if (filters.sort === 'score_desc') {
      return (right.paper.score ?? -1) - (left.paper.score ?? -1)
    }

    const rightDate = right.paper.publishedAt
      ? dayjs(right.paper.publishedAt).valueOf()
      : 0
    const leftDate = left.paper.publishedAt
      ? dayjs(left.paper.publishedAt).valueOf()
      : 0

    return rightDate - leftDate
  })

  return filtered
}

export function buildFiltersMeta(records: Record<string, unknown>[]) {
  const sources = new Set<string>()
  const journals = new Set<string>()
  const collections = new Set<string>()

  for (const record of records) {
    const source = pickString(record.source)
    const journal = pickString(record.journal)

    if (source) sources.add(source)
    if (journal) journals.add(journal)

    for (const collection of asStringArray(record.collections)) {
      collections.add(collection)
    }
  }

  return {
    sources: [...sources].sort((left, right) => left.localeCompare(right)),
    journals: [...journals].sort((left, right) => left.localeCompare(right)),
    collections: [...collections].sort((left, right) => left.localeCompare(right))
  }
}

export function ensureAuthenticatedUser(pb: any) {
  const userId = pb.instance.authStore.record?.id

  if (!userId) {
    throw new ClientError('Unauthorized', 401)
  }

  return userId as string
}

export async function ensureDefaultFavoriteFolder(pb: any, userId: string) {
  const existing = await pb.instance
    .collection(COLLECTION_NAMES.favoriteFolders)
    .getFirstListItem(
      pb.instance.filter('user = {:user} && name = {:name}', {
        user: userId,
        name: DEFAULT_FOLDER_NAME
      })
    )
    .catch(() => null)

  if (existing) return existing

  return pb.instance
    .collection(COLLECTION_NAMES.favoriteFolders)
    .create({
      user: userId,
      name: DEFAULT_FOLDER_NAME,
      sort_order: 0
    })
}

export async function getFavoriteFolderMap(pb: any, userId: string) {
  const favorites = await pb.instance
    .collection(COLLECTION_NAMES.paperFavorites)
    .getFullList({
      filter: pb.instance.filter('user = {:user}', {
        user: userId
      })
    })

  return new Map<string, string>(
    favorites.map((favorite: Record<string, unknown>) => [
      String(favorite.paper),
      String(favorite.folder)
    ])
  )
}

type UploadFile = {
  originalname?: string
  path: string
}

export async function readImportContent(file: UploadFile | string | undefined, content: string | undefined) {
  if (file && typeof file !== 'string') {
    const text = await fs.readFile(file.path, 'utf8')

    fs.unlink(file.path).catch(() => {})

    return text
  }

  if (typeof file === 'string') return file
  if (content) return content

  throw new ClientError('Missing import content', 400)
}

export function parseJsonImport(content: string): unknown[] {
  let parsed: unknown

  try {
    parsed = JSON.parse(content) as unknown
  } catch {
    throw new ClientError('Invalid JSON payload', 400)
  }

  if (Array.isArray(parsed)) return parsed
  if (isRecord(parsed) && Array.isArray(parsed.papers)) return parsed.papers

  return [parsed]
}

export function parseJsonlImport(content: string): unknown[] {
  const lines = content
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  return lines.map((line, index) => {
    try {
      return JSON.parse(line)
    } catch {
      throw new ClientError(`Invalid JSONL at line ${index + 1}`, 400)
    }
  })
}

export async function upsertPaper(
  pb: any,
  paper: NormalizedPaper,
  importBatchId?: string
): Promise<'inserted' | 'updated'> {
  const existing = await pb.instance
    .collection(COLLECTION_NAMES.papers)
    .getFirstListItem(
      pb.instance.filter('fingerprint = {:fingerprint}', {
        fingerprint: paper.fingerprint
      })
    )
    .catch(() => null)

  const createData = {
    external_id: paper.externalId,
    fingerprint: paper.fingerprint,
    title: paper.title,
    translated_title: paper.translatedTitle,
    authors: paper.authors,
    abstract: paper.abstract,
    translated_abstract: paper.translatedAbstract,
    tldr: paper.tldr,
    journal: paper.journal,
    source: paper.source,
    published_at: paper.publishedAt,
    doi: paper.doi,
    url: paper.url,
    pdf_url: paper.pdfUrl,
    collections: paper.collections,
    keywords: paper.keywords,
    score: paper.score,
    raw_payload: paper.rawPayload,
    import_batch: importBatchId
  }

  if (!existing) {
    await pb.instance.collection(COLLECTION_NAMES.papers).create(createData)

    return 'inserted'
  }

  await pb.instance
    .collection(COLLECTION_NAMES.papers)
    .update(
      existing.id,
      compactUpdate({
        ...createData,
        raw_payload: paper.rawPayload,
        import_batch: importBatchId ?? existing.import_batch
      })
    )

  return 'updated'
}

export async function ingestPapers(params: {
  pb: any
  userId: string
  papers: unknown[]
  type: 'json' | 'jsonl' | 'api'
  source?: string
  filename?: string
}) {
  const { pb, userId, papers, type, source, filename } = params

  const batch = await pb.instance
    .collection(COLLECTION_NAMES.importBatches)
    .create({
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

  for (const [index, rawPaper] of papers.entries()) {
    const normalized = normalizeIncomingPaper(rawPaper, { source })

    if (!normalized) {
      skipped += 1
      errors.push(`Item ${index + 1}: skipped because it could not be normalized.`)
      continue
    }

    try {
      const result = await upsertPaper(pb, normalized, batch.id)

      if (result === 'inserted') inserted += 1
      if (result === 'updated') updated += 1
    } catch (error) {
      failed += 1
      errors.push(
        `Item ${index + 1}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  await pb.instance
    .collection(COLLECTION_NAMES.importBatches)
    .update(batch.id, {
      status: inserted > 0 || updated > 0 || skipped > 0 ? 'completed' : 'failed',
      inserted,
      updated_count: updated,
      skipped,
      failed,
      error_log: errors.join('\n').slice(0, 60000)
    })

  return {
    batchId: batch.id,
    inserted,
    updated,
    skipped,
    failed
  } satisfies ImportSummary
}
