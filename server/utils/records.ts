import { ClientError } from '@lifeforge/server-utils'
import dayjs from 'dayjs'
import { createHash } from 'node:crypto'
import {
  COLLECTION_NAMES,
  DEFAULT_FOLDER_NAME,
  IMPORT_TEXT_MAX_LENGTH,
  type ProcessStatusId
} from './constants'

type PocketBase = any

type RecordLike = Record<string, unknown>

export interface PaperListItem {
  id: string
  title: string
  translatedTitle?: string
  authors: string[]
  journal?: string
  source?: string
  publishedAt?: string
  fetchedAt?: string
  doi?: string
  url?: string
  pdfUrl?: string
  keywords: string[]
  matchedCollections: string[]
  score?: number
  tldr?: string
  isFavorite: boolean
  favoriteFolderId?: string
  recommendStatus: ProcessStatusId
  enhanceStatus: ProcessStatusId
  recommendedAt?: string
  enhancedAt?: string
}

export interface PaperDetail extends PaperListItem {
  abstract?: string
  translatedAbstract?: string
  rawPayload?: unknown
  scoreBreakdown: Record<string, number>
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
  sort: 'fetched_desc' | 'published_desc' | 'score_desc'
}

export interface NormalizedPaper {
  title: string
  authors: string[]
  abstract?: string
  journal?: string
  source?: string
  publishedAt?: string
  doi?: string
  url?: string
  pdfUrl?: string
  keywords: string[]
  externalId?: string
  fingerprint: string
  rawPayload: unknown
  abstractStatus: 'ready' | 'missing' | 'error'
  warnings: string[]
}

function normalizeProcessStatus(value: unknown): ProcessStatusId {
  return value === 'completed' || value === 'failed' ? value : 'idle'
}

function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function ensureAuthenticatedUser(pb: PocketBase): string {
  const userId = pb.authStore.record?.id

  if (!userId) {
    throw new ClientError('Authorization token is required', 401)
  }

  return userId
}

export function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()

  if (!trimmed) return undefined

  return trimmed
}

export function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const normalized = asNonEmptyString(value)

    if (normalized) return normalized
  }

  return undefined
}

export function asStringArray(value: unknown): string[] {
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

export function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)

    if (Number.isFinite(parsed)) return parsed
  }

  return undefined
}

export function asDateString(value: unknown): string | undefined {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    return undefined
  }

  const parsed = dayjs(value)

  if (!parsed.isValid()) return undefined

  return parsed.toISOString()
}

export function asUrlString(value: unknown): string | undefined {
  const normalized = asNonEmptyString(value)

  if (!normalized) return undefined

  try {
    const parsed = new URL(normalized)

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return undefined
    }

    return parsed.toString()
  } catch {
    return undefined
  }
}

function truncateText(value: string | undefined, maxLength: number) {
  if (!value) return undefined

  if (value.length <= maxLength) {
    return value
  }

  return value.slice(0, maxLength).trimEnd()
}

export function buildFingerprint(input: {
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

  const title = pickString(paper.title, paper.paper_title, paper.name)
  const abstract = pickString(
    paper.summary,
    paper.abstract,
    paper.description,
    paper.content
  )
  const warnings: string[] = []

  if (!title && !abstract) {
    return null
  }

  const doi = pickString(paper.doi)
  const externalId = pickString(
    paper.external_id,
    paper.id,
    paper.abs,
    paper.url,
    paper.link
  )
  const publishedAt = asDateString(
    paper.published_at ?? paper.published ?? paper.date
  )

  const normalizedAbstract = truncateText(abstract, IMPORT_TEXT_MAX_LENGTH)

  if (abstract && normalizedAbstract && abstract.length > IMPORT_TEXT_MAX_LENGTH) {
    warnings.push(
      `abstract truncated from ${abstract.length} to ${IMPORT_TEXT_MAX_LENGTH} characters`
    )
  }

  return {
    title: title ?? 'Untitled paper',
    authors: asStringArray(paper.authors),
    abstract: normalizedAbstract,
    journal: pickString(paper.journal, paper.publication, paper.venue),
    source: pickString(paper.source, options?.source),
    publishedAt,
    doi,
    url: asUrlString(paper.abs) ?? asUrlString(paper.url) ?? asUrlString(paper.link),
    pdfUrl: asUrlString(paper.pdf) ?? asUrlString(paper.pdf_url),
    keywords: asStringArray(paper.keywords ?? paper.tags ?? paper.topics),
    externalId,
    fingerprint: buildFingerprint({
      doi,
      externalId,
      title: title ?? 'Untitled paper',
      publishedAt,
      source: pickString(paper.source, options?.source)
    }),
    rawPayload: paper,
    abstractStatus: abstract ? 'ready' : 'missing',
    warnings
  }
}

function normalizeScoreBreakdown(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {}

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, score]) => [key, asNumber(score)])
      .filter((entry): entry is [string, number] => entry[1] !== undefined)
  )
}

export function mapPaperRecord(
  record: RecordLike,
  userState?: RecordLike,
  favoriteFolderId?: string
): PaperListItem {
  return {
    id: String(record.id),
    title: pickString(record.title) ?? 'Untitled paper',
    translatedTitle: pickString(userState?.translated_title),
    authors: asStringArray(record.authors),
    journal: pickString(record.journal),
    source: pickString(record.source),
    publishedAt: pickString(record.published_at),
    fetchedAt: pickString(record.fetched_at),
    doi: pickString(record.doi),
    url: pickString(record.url),
    pdfUrl: pickString(record.pdf_url),
    keywords: asStringArray(record.keywords),
    matchedCollections: asStringArray(userState?.matched_collections),
    score: asNumber(userState?.score_max),
    tldr: pickString(userState?.tldr),
    isFavorite: favoriteFolderId !== undefined,
    favoriteFolderId,
    recommendStatus:
      normalizeProcessStatus(pickString(userState?.recommend_status)),
    enhanceStatus:
      normalizeProcessStatus(pickString(userState?.enhance_status)),
    recommendedAt: pickString(userState?.recommended_at),
    enhancedAt: pickString(userState?.enhanced_at)
  }
}

export function mapPaperDetail(
  record: RecordLike,
  userState?: RecordLike,
  favoriteFolderId?: string
): PaperDetail {
  return {
    ...mapPaperRecord(record, userState, favoriteFolderId),
    abstract: pickString(record.abstract),
    translatedAbstract: pickString(userState?.translated_abstract),
    rawPayload: record.raw_payload,
    scoreBreakdown: normalizeScoreBreakdown(userState?.score_breakdown)
  }
}

export async function ensureDefaultFavoriteFolder(pb: PocketBase, userId: string) {
  const existing = await pb
    .collection(COLLECTION_NAMES.favoriteFolders)
    .getFirstListItem(
      pb.filter('user = {:user} && name = {:name}', {
        user: userId,
        name: DEFAULT_FOLDER_NAME
      })
    )
    .catch(() => null)

  if (existing) return existing

  return pb.collection(COLLECTION_NAMES.favoriteFolders).create({
    user: userId,
    name: DEFAULT_FOLDER_NAME,
    sort_order: 1
  })
}

export async function getFavoriteFolderMap(pb: PocketBase, userId: string) {
  const favorites = await pb.collection(COLLECTION_NAMES.paperFavorites).getFullList({
    filter: pb.filter('user = {:user}', {
      user: userId
    })
  })

  return new Map<string, string>(
    favorites.map((favorite: RecordLike) => [
      String(favorite.paper),
      String(favorite.folder)
    ])
  )
}

export async function getUserStateMap(pb: PocketBase, userId: string) {
  const states = await pb.collection(COLLECTION_NAMES.userPaperStates).getFullList({
    filter: pb.filter('user = {:user}', {
      user: userId
    })
  })

  return new Map<string, RecordLike>(
    states.map((state: RecordLike) => [String(state.paper), state])
  )
}

function matchesSearch(
  paper: PaperListItem,
  rawRecord: RecordLike,
  translatedAbstract?: string,
  query?: string
) {
  if (!query) return true

  const lowered = query.toLowerCase()

  return [
    paper.title,
    paper.translatedTitle,
    ...paper.authors,
    paper.journal,
    paper.source,
    ...paper.keywords,
    ...paper.matchedCollections,
    paper.tldr,
    pickString(rawRecord.abstract),
    translatedAbstract
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(lowered)
}

function matchesDateRange(dateValue: string | undefined, from?: string, to?: string) {
  if (!dateValue) return !from && !to

  const current = dayjs(dateValue)

  if (!current.isValid()) return false

  if (from && current.isBefore(dayjs(from), 'day')) return false
  if (to && current.isAfter(dayjs(to).endOf('day'))) return false

  return true
}

export function applyPaperFilters(
  records: RecordLike[],
  userStateMap: Map<string, RecordLike>,
  favoriteFolderMap: Map<string, string>,
  filters: PaperListQuery
) {
  const filtered = records
    .map(record => {
      const id = String(record.id)
      const userState = userStateMap.get(id)

      return {
        record,
        userState,
        paper: mapPaperRecord(record, userState, favoriteFolderMap.get(id))
      }
    })
    .filter(({ paper, record, userState }) => {
      if (filters.favoritesOnly && !paper.isFavorite) return false

      if (
        filters.hasAbstractOnly &&
        !paper.tldr &&
        !pickString(record.abstract) &&
        !pickString(userState?.translated_abstract)
      ) {
        return false
      }

      if (
        filters.sources.length > 0 &&
        (!paper.source || !filters.sources.includes(paper.source))
      ) {
        return false
      }

      if (
        filters.journals.length > 0 &&
        (!paper.journal || !filters.journals.includes(paper.journal))
      ) {
        return false
      }

      if (
        filters.collections.length > 0 &&
        !filters.collections.some(collection =>
          paper.matchedCollections.includes(collection)
        )
      ) {
        return false
      }

      if (
        (filters.dateFrom || filters.dateTo) &&
        !matchesDateRange(paper.fetchedAt, filters.dateFrom, filters.dateTo)
      ) {
        return false
      }

      return matchesSearch(
        paper,
        record,
        pickString(userState?.translated_abstract),
        filters.query
      )
    })

  filtered.sort((left, right) => {
    if (filters.sort === 'score_desc') {
      return (right.paper.score ?? 0) - (left.paper.score ?? 0)
    }

    if (filters.sort === 'published_desc') {
      return (
        dayjs(right.paper.publishedAt).valueOf() -
        dayjs(left.paper.publishedAt).valueOf()
      )
    }

    return dayjs(right.paper.fetchedAt).valueOf() - dayjs(left.paper.fetchedAt).valueOf()
  })

  return filtered
}

export function buildFiltersMeta(
  records: RecordLike[],
  userStateMap: Map<string, RecordLike>
) {
  const sources = new Set<string>()
  const journals = new Set<string>()
  const collections = new Set<string>()

  for (const record of records) {
    const id = String(record.id)
    const userState = userStateMap.get(id)
    const source = pickString(record.source)
    const journal = pickString(record.journal)

    if (source) sources.add(source)
    if (journal) journals.add(journal)

    for (const collection of asStringArray(userState?.matched_collections)) {
      collections.add(collection)
    }
  }

  return {
    sources: [...sources].sort(),
    journals: [...journals].sort(),
    collections: [...collections].sort()
  }
}
