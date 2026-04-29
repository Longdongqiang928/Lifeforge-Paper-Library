import dayjs from 'dayjs'
import { createHash } from 'node:crypto'
import { connectToPocketBase, validateEnvironmentVariables } from '@functions/database/dbUtils'
import { decrypt2, encrypt2 } from '@functions/auth/encryption'

import {
  COLLECTION_NAMES,
  EMBEDDING_REQUEST_TIMEOUT_MS,
  DEFAULT_FETCH_SETTINGS,
  DEFAULT_USER_SETTINGS,
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_RETRY_LIMIT,
  FETCH_REQUEST_TIMEOUT_MS,
  FETCH_RETRY_DELAY_MS,
  FETCH_RETRY_LIMIT,
  RUN_STALE_TIMEOUT_MS,
  RUN_STAGE_IDS,
  RUN_WAIT_POLL_MS,
  ZOTERO_CACHE_TTL_HOURS,
  type RunStageId,
  type RunTriggerId
} from './constants'
import {
  asNumber,
  asStringArray,
  buildFingerprint,
  normalizeIncomingPaper,
  pickString
} from './records'

type PocketBase = any
type RecordLike = Record<string, unknown>

export interface FetchSettingsView {
  rssSources: string
  fetchEnabled: boolean
  fetchTime: string
  abstractEnabled: boolean
  abstractTime: string
  abstractLookbackDays: number
  hasNatureApiKey: boolean
  hasTavilyApiKey: boolean
  updatedAt?: string
}

export interface PersonalSettingsView {
  zoteroUserId: string
  hasZoteroApiKey: boolean
  aiBaseUrl: string
  hasAiApiKey: boolean
  aiModel: string
  embeddingModel: string
  outputLanguage: string
  enhanceThreshold: number
  recommendEnabled: boolean
  recommendTime: string
  enhanceEnabled: boolean
  enhanceTime: string
  recommendLookbackDays: number
  enhanceLookbackDays: number
  updatedAt?: string
}

export interface RunView {
  id: string
  scope: string
  stage: string
  triggeredBy: string
  status: string
  rangeStart?: string
  rangeEnd?: string
  startedAt?: string
  finishedAt?: string
  processedTotal: number
  insertedCount: number
  updatedCount: number
  skippedCount: number
  failedCount: number
  errorSummary?: string
  details?: unknown
  created: string
}

export interface TriggerStagesInput {
  stages: RunStageId[]
  rangeStart?: string
  rangeEnd?: string
}

interface DecryptedFetchSettings {
  id: string
  rssSources: string
  natureApiKey?: string
  tavilyApiKey?: string
  fetchEnabled: boolean
  fetchTime: string
  abstractEnabled: boolean
  abstractTime: string
  abstractLookbackDays: number
  lastFetchScheduleKey?: string
  lastAbstractScheduleKey?: string
}

interface DecryptedUserSettings {
  id: string
  userId: string
  zoteroUserId?: string
  zoteroApiKey?: string
  aiBaseUrl: string
  aiApiKey?: string
  aiModel: string
  embeddingModel: string
  outputLanguage: string
  enhanceThreshold: number
  recommendEnabled: boolean
  recommendTime: string
  enhanceEnabled: boolean
  enhanceTime: string
  lastRecommendScheduleKey?: string
  lastEnhanceScheduleKey?: string
  recommendLookbackDays: number
  enhanceLookbackDays: number
}

function getLegacyAbstractUserSettingsCompat(record: RecordLike) {
  const abstractLookbackDays = asNumber(record.abstract_lookback_days)

  return {
    abstract_enabled:
      typeof record.abstract_enabled === 'boolean'
        ? record.abstract_enabled
        : DEFAULT_FETCH_SETTINGS.abstractEnabled,
    abstract_time:
      pickString(record.abstract_time) ?? DEFAULT_FETCH_SETTINGS.abstractTime,
    abstract_lookback_days:
      abstractLookbackDays && abstractLookbackDays > 0
        ? abstractLookbackDays
        : DEFAULT_FETCH_SETTINGS.abstractLookbackDays,
    last_abstract_schedule_key: pickString(record.last_abstract_schedule_key) ?? ''
  }
}

interface RunStats {
  processedTotal: number
  insertedCount: number
  updatedCount: number
  skippedCount: number
  failedCount: number
  details?: unknown
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Unknown error'
}

let schedulerPBPromise: Promise<PocketBase> | null = null
const cancelledRunIds = new Set<string>()
const processStartedAt = dayjs()
let startupRunsReconciled = false

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function buildStableHash(parts: Array<string | undefined>) {
  return createHash('sha1')
    .update(parts.map(part => part ?? '').join('::'))
    .digest('hex')
}

function getPaperAbstractState(paper: RecordLike) {
  const rawStatus = pickString(paper.abstract_status)

  if (rawStatus === 'ready' || rawStatus === 'missing' || rawStatus === 'error') {
    return rawStatus
  }

  return pickString(paper.abstract) ? ('ready' as const) : ('missing' as const)
}

function getReadyAbstract(paper: RecordLike) {
  if (getPaperAbstractState(paper) !== 'ready') return undefined

  return pickString(paper.abstract)
}

function buildRecommendCorpusHash(entries: Array<RecordLike>) {
  return buildStableHash(
    entries
      .map(entry =>
        [
          getCacheEntryKey(entry),
          getCacheEntryText(entry),
          asStringArray(entry.collections).sort().join('|')
        ].join('::')
      )
      .sort()
  )
}

function buildRecommendInputHash(
  abstract: string,
  settings: Pick<DecryptedUserSettings, 'embeddingModel'>,
  corpusHash: string
) {
  return buildStableHash([abstract, settings.embeddingModel, corpusHash])
}

function buildEnhanceInputHash(
  abstract: string,
  settings: Pick<DecryptedUserSettings, 'aiModel' | 'outputLanguage'>
) {
  return buildStableHash([abstract, settings.aiModel, settings.outputLanguage])
}

function buildScheduleKey(now: dayjs.Dayjs, time: string) {
  return `${now.format('YYYY-MM-DD')}::${time}`
}

async function runWithRetry<T>(
  action: () => Promise<T>,
  label: string,
  attempts = FETCH_RETRY_LIMIT
): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action()
    } catch (error) {
      lastError = error

      if (attempt >= attempts) {
        break
      }

      console.warn(
        `[paper-library] ${label} failed on attempt ${attempt}/${attempts}: ${getErrorMessage(
          error
        )}`
      )
      await sleep(FETCH_RETRY_DELAY_MS * attempt)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(getErrorMessage(lastError))
}

function getRunStartedAt(run: RecordLike) {
  return pickString(run.started_at) ?? String(run.created)
}

function isRunStale(run: RecordLike, now = dayjs()) {
  return now.diff(dayjs(getRunStartedAt(run))) > RUN_STALE_TIMEOUT_MS
}

async function listRunningStageRuns(
  pb: PocketBase,
  params: {
    stage: RunStageId
    scope: 'global' | 'user'
    userId?: string
  }
) {
  const filter =
    params.scope === 'global'
      ? pb.filter('stage = {:stage} && scope = "global" && status = "running"', {
          stage: params.stage
        })
      : pb.filter(
          'stage = {:stage} && scope = "user" && user = {:user} && status = "running"',
          {
            stage: params.stage,
            user: params.userId
          }
        )

  return pb.collection(COLLECTION_NAMES.pipelineRuns).getFullList({
    filter,
    sort: 'created'
  })
}

async function markRunFailed(
  pb: PocketBase,
  run: RecordLike,
  reason: string
) {
  const currentDetails =
    run.details && typeof run.details === 'object' ? (run.details as RecordLike) : {}

  cancelledRunIds.add(String(run.id))

  await pb.collection(COLLECTION_NAMES.pipelineRuns).update(String(run.id), {
    status: 'failed',
    finished_at: new Date().toISOString(),
    error_summary: reason,
    details: {
      ...currentDetails,
      recovered: true,
      recoveryReason: reason
    }
  })
}

async function recycleRunningStageRuns(
  pb: PocketBase,
  params: {
    stage: RunStageId
    scope: 'global' | 'user'
    userId?: string
    reason: string
  }
) {
  const runs = await listRunningStageRuns(pb, params)

  for (const run of runs) {
    await markRunFailed(pb, run, params.reason)
  }
}

async function recoverStaleRunningRuns(pb: PocketBase) {
  const runs = await pb.collection(COLLECTION_NAMES.pipelineRuns).getFullList({
    filter: 'status = "running"',
    sort: 'created'
  })

  for (const run of runs) {
    if (!isRunStale(run)) {
      continue
    }

    await markRunFailed(
      pb,
      run,
      `Marked failed as stale after exceeding ${RUN_STALE_TIMEOUT_MS}ms`
    )
  }
}

async function reconcileOrphanedRunningRunsOnStartup(pb: PocketBase) {
  if (startupRunsReconciled) {
    return
  }

  const runs = await pb.collection(COLLECTION_NAMES.pipelineRuns).getFullList({
    filter: 'status = "running"',
    sort: 'created'
  })

  for (const run of runs) {
    if (dayjs(getRunStartedAt(run)).isBefore(processStartedAt)) {
      await markRunFailed(
        pb,
        run,
        'Marked failed after server restart interrupted the run'
      )
    }
  }

  startupRunsReconciled = true
}

async function waitForStageToFinish(
  pb: PocketBase,
  params: {
    stage: RunStageId
    scope: 'global' | 'user'
    userId?: string
    waitingStage: RunStageId
  }
) {
  while (true) {
    const runs = await listRunningStageRuns(pb, params)

    if (runs.length === 0) {
      return
    }

    const staleRuns = runs.filter((run: RecordLike) => isRunStale(run))

    if (staleRuns.length > 0) {
      for (const run of staleRuns) {
        await markRunFailed(
          pb,
          run,
          `Marked failed as stale while waiting for ${params.waitingStage}`
        )
      }

      continue
    }

    await sleep(RUN_WAIT_POLL_MS)
  }
}

function throwIfRunCancelled(runId: string, stage: RunStageId) {
  if (cancelledRunIds.has(runId)) {
    throw new Error(`${stage} run was cancelled in favor of a newer ${stage} run`)
  }
}

function isRunCancellationError(error: unknown) {
  return getErrorMessage(error).includes('cancelled in favor of a newer')
}

function getMasterKey() {
  if (!process.env.MASTER_KEY) {
    throw new Error('MASTER_KEY is not configured')
  }

  return process.env.MASTER_KEY
}

function encryptSecret(value?: string) {
  if (!value) return ''

  return encrypt2(value, getMasterKey())
}

function decryptSecret(value?: string) {
  if (!value) return undefined

  try {
    return decrypt2(value, getMasterKey()).toString()
  } catch {
    return undefined
  }
}

function compactUpdate(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  )
}

function parseRSSSources(input: string) {
  return input
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const [source, rawCategories = ''] = entry.split(':')

      return {
        source: source.trim(),
        categories: rawCategories
          .split('+')
          .map(item => item.trim())
          .filter(Boolean)
      }
    })
}

function cleanExtractedAbstract(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[\d+\]/g, '')
    .replace(/\*\*Fig\..*?\*\*/gi, '')
    .replace(/Download Full Size.*?PDF/gi, '')
    .replace(/View in Article.*/gi, '')
    .split(/\s+/)
    .join(' ')
    .trim()
}

function extractByPatterns(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = pattern.exec(text)

    if (!match?.[1]) {
      continue
    }

    const content = cleanExtractedAbstract(match[1])

    if (content.length > 150) {
      return content
    }
  }

  return ''
}

function extractScienceAbstract(text: string) {
  return extractByPatterns(text, [
    /## Abstract\s*\n\s*(.+?)(?=\n\s*(?:##|###|Access|Supplementary|References|Information|Metrics))/is,
    /Abstract\s*\n[= \-]+\n\s*(.+?)(?=\n\s*(?:##|###|Access|Supplementary|References|Information|Metrics))/is,
    /\nAbstract\n\s*(.+?)(?=\n\s*(?:##|###|Access|Supplementary|References|Information|Metrics))/is
  ])
}

function extractAPSAbstract(text: string) {
  return extractByPatterns(text, [
    /Abstract\s*\n[= \-]+\n\s*(.+?)(?=\n\s*(?:Received|Published|DOI:|Introduction|### ))/is,
    /Abstract\s*\n\s*(.+?)(?=\n\s*(?:Received|Published|DOI:|Introduction|### ))/is
  ])
}

function extractOpticaAbstract(text: string) {
  if (/Radware Captcha Page/i.test(text)) {
    return ''
  }

  return extractByPatterns(text, [
    /Abstract\s*\n[= \-]+\n\s*(.+?)(?=\n\s*(?:©|Introduction|Methods|References|###|Related Topics))/is,
    /Abstract\s*\n\s*(.+?)(?=\n\s*(?:©|Introduction|Methods|References|###))/is,
    /Abstract\s*\n[= \-]+\n\s*(.+?)(?=\n\n\n|$)/is
  ])
}

function extractGenericAbstract(text: string) {
  const extracted = extractByPatterns(text, [
    /Abstract\s*\n[-=]+\s*\n(.+?)(?=\n\d+\.\s|\n[A-Z][A-Z]+\n|© \d{4}|INTRODUCTION|Keywords|References)/is,
    /\bAbstract\b[:\s]*\n?(.+?)(?=\n\d+\.\s|\n##|\n\*\*[A-Z]|© \d{4}|\n[A-Z]{4,}\n|Introduction\n)/is,
    /\bAbstract\b[:\s]+(.+?)(?=\n\n\d+\.|\n\n[A-Z][a-z]+:)/is
  ])

  if (extracted) {
    return extracted
  }

  if (text.length > 500 && text.length < 10000) {
    return cleanExtractedAbstract(text.slice(0, 2000))
  }

  return ''
}

function extractAbstractFromTavilyContent(text: string, source: string) {
  if (!text) {
    return ''
  }

  const extracted =
    source === 'science'
      ? extractScienceAbstract(text)
      : source === 'aps'
        ? extractAPSAbstract(text)
        : source === 'optica'
          ? extractOpticaAbstract(text)
          : extractGenericAbstract(text)

  if (extracted) {
    return extracted
  }

  return extractGenericAbstract(text)
}

function buildFeedUrls(source: string, categories: string[]) {
  if (source === 'arxiv') {
    return [
      `https://rss.arxiv.org/rss/${categories.join('+') || 'physics+quant-ph'}`
    ]
  }

  if (source === 'nature') {
    return categories.map(category => `https://www.nature.com/${category}.rss`)
  }

  if (source === 'science') {
    return categories.map(
      category =>
        `https://www.science.org/action/showFeed?type=etoc&feed=rss&jc=${category}`
    )
  }

  if (source === 'optica') {
    return categories.map(category => `https://opg.optica.org/rss/${category}_feed.xml`)
  }

  if (source === 'aps') {
    return categories.map(
      category => `https://feeds.aps.org/rss/recent/${category}.xml`
    )
  }

  return []
}

function decodeHTML(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripHTML(value: string) {
  return decodeHTML(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractTagValues(xml: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi')
  const results: string[] = []
  let match: RegExpExecArray | null = pattern.exec(xml)

  while (match) {
    results.push(stripHTML(match[1]))
    match = pattern.exec(xml)
  }

  return results
}

function extractTagValue(xml: string, tagNames: string[]) {
  for (const tagName of tagNames) {
    const [value] = extractTagValues(xml, tagName)

    if (value) return value
  }

  return undefined
}

function parseRSSItems(xml: string, source: string) {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? []

  return items
    .map(item => {
      const title = extractTagValue(item, ['title'])
      const link = extractTagValue(item, ['link'])
      const rawDoi = extractTagValue(item, ['prism:doi', 'dc:identifier'])
      const doi = rawDoi ? rawDoi.replace(/^doi:/i, '') : undefined
      const publication = extractTagValue(item, [
        'prism:publicationname',
        'prism:publicationName'
      ])
      const description = extractTagValue(item, ['description', 'summary'])
      const published = extractTagValue(item, ['pubDate', 'prism:publicationDate', 'updated'])
      const authors = [
        ...extractTagValues(item, 'dc:creator'),
        ...extractTagValues(item, 'author')
      ]

      const shouldTrustRSSSummary =
        !['science', 'aps', 'optica', 'nature'].includes(source)
      const normalizedSummary = shouldTrustRSSSummary
        ? description?.includes('Abstract:')
          ? description.split('Abstract:').pop()?.trim()
          : description
        : undefined
      const abstractUrl = doi ? `https://doi.org/${doi}` : link

      return normalizeIncomingPaper(
        {
          id: doi ?? link,
          title,
          summary: normalizedSummary,
          authors,
          journal: publication,
          published,
          doi,
          url: link,
          abs: abstractUrl
        },
        {
          source
        }
      )
    })
    .filter((item): item is NonNullable<typeof item> => !!item)
}

async function fetchJSON(url: string, init?: RequestInit, timeoutMs = FETCH_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response

  try {
    response = await fetch(url, {
      ...init,
      signal: controller.signal
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`)
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

async function fetchText(url: string, init?: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_REQUEST_TIMEOUT_MS)
  let response: Response

  try {
    response = await fetch(url, {
      ...init,
      signal: controller.signal
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${FETCH_REQUEST_TIMEOUT_MS}ms`)
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`)
  }

  return response.text()
}

function looksLikeRSSDocument(content: string) {
  return /<rss[\s>]|<feed[\s>]|<channel[\s>]|<item[\s>]|<entry[\s>]/i.test(content)
}

async function getOrCreateFetchSettingsRecord(pb: PocketBase) {
  const existing = await pb
    .collection(COLLECTION_NAMES.fetchSettings)
    .getFirstListItem('config_key = "global"')
    .catch(() => null)

  if (existing) return existing

  return pb.collection(COLLECTION_NAMES.fetchSettings).create({
    config_key: 'global',
    rss_sources: DEFAULT_FETCH_SETTINGS.rssSources,
    fetch_enabled: DEFAULT_FETCH_SETTINGS.fetchEnabled,
    fetch_time: DEFAULT_FETCH_SETTINGS.fetchTime,
    abstract_enabled: DEFAULT_FETCH_SETTINGS.abstractEnabled,
    abstract_time: DEFAULT_FETCH_SETTINGS.abstractTime,
    abstract_lookback_days: DEFAULT_FETCH_SETTINGS.abstractLookbackDays
  })
}

async function getOrCreateUserSettingsRecord(pb: PocketBase, userId: string) {
  const existing = await pb
    .collection(COLLECTION_NAMES.userSettings)
    .getFirstListItem(
      pb.filter('user = {:user}', {
        user: userId
      })
    )
    .catch(() => null)

  if (existing) return existing

  return pb.collection(COLLECTION_NAMES.userSettings).create({
    user: userId,
    ai_base_url: DEFAULT_USER_SETTINGS.aiBaseUrl,
    ai_model: DEFAULT_USER_SETTINGS.aiModel,
    embedding_model: DEFAULT_USER_SETTINGS.embeddingModel,
    output_language: DEFAULT_USER_SETTINGS.outputLanguage,
    enhance_threshold: DEFAULT_USER_SETTINGS.enhanceThreshold,
    recommend_enabled: DEFAULT_USER_SETTINGS.recommendEnabled,
    recommend_time: DEFAULT_USER_SETTINGS.recommendTime,
    enhance_enabled: DEFAULT_USER_SETTINGS.enhanceEnabled,
    enhance_time: DEFAULT_USER_SETTINGS.enhanceTime,
    abstract_enabled: DEFAULT_FETCH_SETTINGS.abstractEnabled,
    abstract_time: DEFAULT_FETCH_SETTINGS.abstractTime,
    abstract_lookback_days: DEFAULT_FETCH_SETTINGS.abstractLookbackDays,
    recommend_lookback_days: DEFAULT_USER_SETTINGS.recommendLookbackDays,
    enhance_lookback_days: DEFAULT_USER_SETTINGS.enhanceLookbackDays
  })
}

async function getFetchSettingsInternal(pb: PocketBase): Promise<DecryptedFetchSettings> {
  const record = await getOrCreateFetchSettingsRecord(pb)

  return {
    id: record.id,
    rssSources: pickString(record.rss_sources) ?? DEFAULT_FETCH_SETTINGS.rssSources,
    natureApiKey: decryptSecret(pickString(record.nature_api_key)),
    tavilyApiKey: decryptSecret(pickString(record.tavily_api_key)),
    fetchEnabled: !!record.fetch_enabled,
    fetchTime: pickString(record.fetch_time) ?? DEFAULT_FETCH_SETTINGS.fetchTime,
    abstractEnabled:
      typeof record.abstract_enabled === 'boolean'
        ? record.abstract_enabled
        : DEFAULT_FETCH_SETTINGS.abstractEnabled,
    abstractTime:
      pickString(record.abstract_time) ?? DEFAULT_FETCH_SETTINGS.abstractTime,
    abstractLookbackDays:
      asNumber(record.abstract_lookback_days) ??
      DEFAULT_FETCH_SETTINGS.abstractLookbackDays,
    lastFetchScheduleKey: pickString(record.last_fetch_schedule_key),
    lastAbstractScheduleKey: pickString(record.last_abstract_schedule_key)
  }
}

async function getUserSettingsInternal(
  pb: PocketBase,
  userId: string
): Promise<DecryptedUserSettings> {
  const record = await getOrCreateUserSettingsRecord(pb, userId)

  return {
    id: record.id,
    userId,
    zoteroUserId: pickString(record.zotero_user_id),
    zoteroApiKey: decryptSecret(pickString(record.zotero_api_key)),
    aiBaseUrl: pickString(record.ai_base_url) ?? DEFAULT_USER_SETTINGS.aiBaseUrl,
    aiApiKey: decryptSecret(pickString(record.ai_api_key)),
    aiModel: pickString(record.ai_model) ?? DEFAULT_USER_SETTINGS.aiModel,
    embeddingModel:
      pickString(record.embedding_model) ?? DEFAULT_USER_SETTINGS.embeddingModel,
    outputLanguage:
      pickString(record.output_language) ?? DEFAULT_USER_SETTINGS.outputLanguage,
    enhanceThreshold:
      asNumber(record.enhance_threshold) ?? DEFAULT_USER_SETTINGS.enhanceThreshold,
    recommendEnabled:
      typeof record.recommend_enabled === 'boolean'
        ? record.recommend_enabled
        : DEFAULT_USER_SETTINGS.recommendEnabled,
    recommendTime:
      pickString(record.recommend_time) ?? DEFAULT_USER_SETTINGS.recommendTime,
    enhanceEnabled:
      typeof record.enhance_enabled === 'boolean'
        ? record.enhance_enabled
        : DEFAULT_USER_SETTINGS.enhanceEnabled,
    enhanceTime:
      pickString(record.enhance_time) ?? DEFAULT_USER_SETTINGS.enhanceTime,
    lastRecommendScheduleKey: pickString(record.last_recommend_schedule_key),
    lastEnhanceScheduleKey: pickString(record.last_enhance_schedule_key),
    recommendLookbackDays:
      asNumber(record.recommend_lookback_days) ??
      DEFAULT_USER_SETTINGS.recommendLookbackDays,
    enhanceLookbackDays:
      asNumber(record.enhance_lookback_days) ??
      DEFAULT_USER_SETTINGS.enhanceLookbackDays
  }
}

export async function getFetchSettingsView(pb: PocketBase): Promise<FetchSettingsView> {
  const record = await getOrCreateFetchSettingsRecord(pb)

  return {
    rssSources: pickString(record.rss_sources) ?? DEFAULT_FETCH_SETTINGS.rssSources,
    fetchEnabled: !!record.fetch_enabled,
    fetchTime: pickString(record.fetch_time) ?? DEFAULT_FETCH_SETTINGS.fetchTime,
    abstractEnabled:
      typeof record.abstract_enabled === 'boolean'
        ? record.abstract_enabled
        : DEFAULT_FETCH_SETTINGS.abstractEnabled,
    abstractTime:
      pickString(record.abstract_time) ?? DEFAULT_FETCH_SETTINGS.abstractTime,
    abstractLookbackDays:
      asNumber(record.abstract_lookback_days) ??
      DEFAULT_FETCH_SETTINGS.abstractLookbackDays,
    hasNatureApiKey: !!pickString(record.nature_api_key),
    hasTavilyApiKey: !!pickString(record.tavily_api_key),
    updatedAt: pickString(record.updated)
  }
}

export async function updateFetchSettingsView(
  pb: PocketBase,
  userId: string,
  input: {
    rssSources: string
    fetchEnabled: boolean
    fetchTime: string
    abstractEnabled: boolean
    abstractTime: string
    abstractLookbackDays: number
    natureApiKey?: string
    tavilyApiKey?: string
  }
) {
  const record = await getOrCreateFetchSettingsRecord(pb)
  const current = await getFetchSettingsInternal(pb)

  await pb.collection(COLLECTION_NAMES.fetchSettings).update(
    record.id,
    compactUpdate({
      rss_sources: input.rssSources.trim() || current.rssSources,
      fetch_enabled: input.fetchEnabled,
      fetch_time: input.fetchTime,
      abstract_enabled: input.abstractEnabled,
      abstract_time: input.abstractTime,
      abstract_lookback_days: input.abstractLookbackDays,
      nature_api_key:
        input.natureApiKey !== undefined
          ? encryptSecret(input.natureApiKey.trim())
          : record.nature_api_key,
      tavily_api_key:
        input.tavilyApiKey !== undefined
          ? encryptSecret(input.tavilyApiKey.trim())
          : record.tavily_api_key,
      last_updated_by: userId
    })
  )

  return getFetchSettingsView(pb)
}

export async function getPersonalSettingsView(
  pb: PocketBase,
  userId: string
): Promise<PersonalSettingsView> {
  const record = await getOrCreateUserSettingsRecord(pb, userId)

  return {
    zoteroUserId: pickString(record.zotero_user_id) ?? '',
    hasZoteroApiKey: !!pickString(record.zotero_api_key),
    aiBaseUrl: pickString(record.ai_base_url) ?? DEFAULT_USER_SETTINGS.aiBaseUrl,
    hasAiApiKey: !!pickString(record.ai_api_key),
    aiModel: pickString(record.ai_model) ?? DEFAULT_USER_SETTINGS.aiModel,
    embeddingModel:
      pickString(record.embedding_model) ?? DEFAULT_USER_SETTINGS.embeddingModel,
    outputLanguage:
      pickString(record.output_language) ?? DEFAULT_USER_SETTINGS.outputLanguage,
    enhanceThreshold:
      asNumber(record.enhance_threshold) ?? DEFAULT_USER_SETTINGS.enhanceThreshold,
    recommendEnabled:
      typeof record.recommend_enabled === 'boolean'
        ? record.recommend_enabled
        : DEFAULT_USER_SETTINGS.recommendEnabled,
    recommendTime:
      pickString(record.recommend_time) ?? DEFAULT_USER_SETTINGS.recommendTime,
    enhanceEnabled:
      typeof record.enhance_enabled === 'boolean'
        ? record.enhance_enabled
        : DEFAULT_USER_SETTINGS.enhanceEnabled,
    enhanceTime:
      pickString(record.enhance_time) ?? DEFAULT_USER_SETTINGS.enhanceTime,
    recommendLookbackDays:
      asNumber(record.recommend_lookback_days) ??
      DEFAULT_USER_SETTINGS.recommendLookbackDays,
    enhanceLookbackDays:
      asNumber(record.enhance_lookback_days) ??
      DEFAULT_USER_SETTINGS.enhanceLookbackDays,
    updatedAt: pickString(record.updated)
  }
}

export async function updatePersonalSettingsView(
  pb: PocketBase,
  userId: string,
  input: {
    zoteroUserId: string
    zoteroApiKey?: string
    aiBaseUrl: string
    aiApiKey?: string
    aiModel: string
    embeddingModel: string
    outputLanguage: string
    enhanceThreshold: number
    recommendEnabled: boolean
    recommendTime: string
    enhanceEnabled: boolean
    enhanceTime: string
    recommendLookbackDays: number
    enhanceLookbackDays: number
  }
) {
  const record = await getOrCreateUserSettingsRecord(pb, userId)
  const legacyCompat = getLegacyAbstractUserSettingsCompat(record)

  await pb.collection(COLLECTION_NAMES.userSettings).update(
    record.id,
    compactUpdate({
      zotero_user_id: input.zoteroUserId.trim(),
      zotero_api_key:
        input.zoteroApiKey !== undefined
          ? encryptSecret(input.zoteroApiKey.trim())
          : record.zotero_api_key,
      ai_base_url: input.aiBaseUrl.trim(),
      ai_api_key:
        input.aiApiKey !== undefined
          ? encryptSecret(input.aiApiKey.trim())
          : record.ai_api_key,
      ai_model: input.aiModel.trim(),
      embedding_model: input.embeddingModel.trim(),
      output_language: input.outputLanguage.trim(),
      enhance_threshold: input.enhanceThreshold,
      recommend_enabled: input.recommendEnabled,
      recommend_time: input.recommendTime,
      enhance_enabled: input.enhanceEnabled,
      enhance_time: input.enhanceTime,
      ...legacyCompat,
      recommend_lookback_days: input.recommendLookbackDays,
      enhance_lookback_days: input.enhanceLookbackDays
    })
  )

  return getPersonalSettingsView(pb, userId)
}

function createLockKey(
  stage: RunStageId,
  scope: 'global' | 'user',
  userId?: string,
  rangeStart?: string,
  rangeEnd?: string
) {
  return [scope, stage, userId ?? 'shared', rangeStart ?? 'today', rangeEnd ?? 'today'].join('::')
}

async function startRun(
  pb: PocketBase,
  params: {
    stage: RunStageId
    scope: 'global' | 'user'
    triggeredBy: RunTriggerId
    userId?: string
    rangeStart?: string
    rangeEnd?: string
  }
) {
  const lockKey = createLockKey(
    params.stage,
    params.scope,
    params.userId,
    params.rangeStart,
    params.rangeEnd
  )

  const existing = await pb
    .collection(COLLECTION_NAMES.pipelineRuns)
    .getFirstListItem(
      pb.filter('status = "running" && lock_key = {:lockKey}', {
        lockKey
      })
    )
    .catch(() => null)

  if (existing) {
    throw new Error(`A ${params.stage} run is already in progress`)
  }

  return pb.collection(COLLECTION_NAMES.pipelineRuns).create({
    scope: params.scope,
    stage: params.stage,
    triggered_by: params.triggeredBy,
    user: params.userId,
    status: 'running',
    lock_key: lockKey,
    range_start: params.rangeStart,
    range_end: params.rangeEnd,
    started_at: new Date().toISOString()
  })
}

async function prepareStageExecution(
  pb: PocketBase,
  stage: RunStageId,
  params: {
    userId?: string
  }
) {
  if (stage === 'fetch') {
    await recycleRunningStageRuns(pb, {
      stage: 'fetch',
      scope: 'global',
      reason: 'Marked failed because a newer fetch run started'
    })

    return
  }

  if (stage === 'abstract') {
    await recycleRunningStageRuns(pb, {
      stage: 'abstract',
      scope: 'global',
      reason: 'Marked failed because a newer abstract run started'
    })

    await waitForStageToFinish(pb, {
      stage: 'fetch',
      scope: 'global',
      waitingStage: 'abstract'
    })

    return
  }

  if (stage === 'recommend') {
    await recycleRunningStageRuns(pb, {
      stage: 'recommend',
      scope: 'user',
      userId: params.userId,
      reason: 'Marked failed because a newer recommend run started'
    })

    await waitForStageToFinish(pb, {
      stage: 'abstract',
      scope: 'global',
      waitingStage: 'recommend'
    })

    return
  }

  if (stage === 'enhance') {
    await recycleRunningStageRuns(pb, {
      stage: 'enhance',
      scope: 'user',
      userId: params.userId,
      reason: 'Marked failed because a newer enhance run started'
    })

    await waitForStageToFinish(pb, {
      stage: 'recommend',
      scope: 'user',
      userId: params.userId,
      waitingStage: 'enhance'
    })
  }
}

async function finishRun(
  pb: PocketBase,
  runId: string,
  status: 'completed' | 'failed',
  stats: RunStats,
  errorSummary?: string
) {
  await pb.collection(COLLECTION_NAMES.pipelineRuns).update(runId, {
    status,
    finished_at: new Date().toISOString(),
    processed_total: stats.processedTotal,
    inserted_count: stats.insertedCount,
    updated_count: stats.updatedCount,
    skipped_count: stats.skippedCount,
    failed_count: stats.failedCount,
    error_summary: errorSummary ?? '',
    details: stats.details ?? {}
  })
}

function normalizeDoiValue(value: string) {
  return value
    .trim()
    .replace(/^doi:/i, '')
    .replace(/^https?:\/\/doi\.org\//i, '')
    .replace(/^https?:\/\/dx\.doi\.org\//i, '')
}

function normalizeUrlForMatch(url: string) {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
}

function urlsMatch(url1: string, url2: string) {
  const doiPattern = /10\.\d{4,}\/[^\s]+/i
  const doi1 = url1.match(doiPattern)
  const doi2 = url2.match(doiPattern)

  if (doi1 && doi2) {
    return normalizeDoiValue(doi1[0]) === normalizeDoiValue(doi2[0])
  }

  return normalizeUrlForMatch(url1) === normalizeUrlForMatch(url2)
}

async function resolveNatureAbstractBatch(
  papers: Array<RecordLike>,
  apiKey: string,
  source: string
) {
  const papersWithAbs: Array<RecordLike> = []
  const papersWithoutAbs: Array<RecordLike> = []
  const paperFailed: Array<RecordLike> = []
  const doiToPaper = new Map<string, RecordLike>()
  const doisToFetch: string[] = []

  for (const paper of papers) {
    if (pickString(paper.abstract)) {
      papersWithAbs.push(paper)
      continue
    }

    const rawDoi = pickString(paper.doi, paper.id)
    const doi = rawDoi ? normalizeDoiValue(rawDoi) : undefined

    if (doi) {
      doisToFetch.push(doi)
      doiToPaper.set(doi, paper)
    } else {
      papersWithoutAbs.push(paper)
    }
  }

  if (!doisToFetch.length) {
    return {
      papersWithAbs,
      papersWithoutAbs,
      paperFailed
    }
  }

  let remainingDois = Array.from(new Set(doisToFetch))
  const maxRetries = FETCH_RETRY_LIMIT

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    if (!remainingDois.length) break

    if (attempt > 0) {
      const waitTime = (2 ** attempt) + Math.random()
      console.log(
        `[paper-library] Retrying Nature API (attempt ${attempt + 1}/${maxRetries}) in ${waitTime.toFixed(2)}s...`
      )
      await sleep(waitTime * 1000)
    }

    const currentBatchDois = [...remainingDois]
    const batchSize = 20

    for (let index = 0; index < currentBatchDois.length; index += batchSize) {
      const batch = currentBatchDois.slice(index, index + batchSize)
      console.log(
        `[paper-library] Fetching Nature batch ${Math.floor(index / batchSize) + 1} (${batch.length} DOIs), attempt ${attempt + 1}`
      )

      try {
        const query = batch
          .map(doi => `doi:"${encodeURIComponent(doi)}"`)
          .join(' OR ')
        const data = (await fetchJSON(
          `https://api.springernature.com/metadata/json?api_key=${apiKey}&callback=&s=1&p=25&q=(${query})`
        )) as { records?: Array<RecordLike> }
        const records = data.records ?? []

        console.log(
          `[paper-library] Nature batch ${Math.floor(index / batchSize) + 1} returned ${records.length} articles`
        )

        for (const record of records) {
          const recordDoiRaw = pickString(record.doi, record.identifier)
          const recordDoi = recordDoiRaw
            ? normalizeDoiValue(recordDoiRaw)
            : undefined

          if (!recordDoi) continue

          const original = doiToPaper.get(recordDoi)
          if (!original) continue

          const abstract = pickString(record.abstract)
          if (!abstract) continue

          if (remainingDois.includes(recordDoi)) {
            remainingDois = remainingDois.filter(doi => doi !== recordDoi)
          }

          original.abstract = abstract
          if (!pickString(original.journal)) {
            original.journal = pickString(record.publicationName)
          }
          if (!asStringArray(original.authors).length) {
            original.authors = asStringArray(
              (record.creators as Array<RecordLike> | undefined)?.map(
                creator => creator.creator
              ) ?? []
            )
          }
          if (!pickString(original.publishedAt)) {
            original.publishedAt = pickString(record.publicationDate)
          }
          if (!asStringArray(original.keywords).length) {
            original.keywords = asStringArray(record.subjects)
          }
          papersWithAbs.push(original)
        }
      } catch (error) {
        console.warn(
          `[paper-library] Nature batch ${Math.floor(index / batchSize) + 1} failed (round ${attempt + 1}): ${getErrorMessage(
            error
          )}`
        )
      }
    }
  }

  if (remainingDois.length) {
    for (const doi of remainingDois) {
      const paper = doiToPaper.get(doi)
      if (!paper) continue
      paperFailed.push(paper)
      console.warn(
        `[paper-library] Nature API failed after ${maxRetries} attempts for DOI: ${doi}`
      )
    }
  }

  return {
    papersWithAbs,
    papersWithoutAbs,
    paperFailed
  }
}

async function resolveTavilyAbstractBatch(
  papers: Array<RecordLike>,
  apiKey: string,
  source: string
) {
  const papersWithAbs: Array<RecordLike> = []
  const papersWithoutAbs: Array<RecordLike> = []
  const paperFailed: Array<RecordLike> = []
  const urlToPaper = new Map<string, RecordLike>()
  const urlsToFetch: string[] = []

  for (const paper of papers) {
    if (pickString(paper.abstract)) {
      papersWithAbs.push(paper)
      continue
    }

    const url = pickString(paper.url, paper.abs)
    if (!url) {
      papersWithoutAbs.push(paper)
      continue
    }

    urlsToFetch.push(url)
    urlToPaper.set(url, paper)
  }

  if (!urlsToFetch.length) {
    return {
      papersWithAbs,
      papersWithoutAbs,
      paperFailed
    }
  }

  let remainingUrls = Array.from(new Set(urlsToFetch))
  const maxRetries = FETCH_RETRY_LIMIT

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    if (!remainingUrls.length) break

    if (attempt > 0) {
      const waitTime = (2 ** attempt) + Math.random()
      console.log(
        `[paper-library] Retrying Tavily API (attempt ${attempt + 1}/${maxRetries}) in ${waitTime.toFixed(2)}s...`
      )
      await sleep(waitTime * 1000)
    }

    const currentRoundUrls = [...remainingUrls]
    const batchSize = 20

    for (let index = 0; index < currentRoundUrls.length; index += batchSize) {
      const batchUrls = currentRoundUrls.slice(index, index + batchSize)
      const batchNum = Math.floor(index / batchSize) + 1

      console.log(
        `[paper-library] Processing Tavily batch ${batchNum} (${batchUrls.length} URLs), attempt ${attempt + 1}`
      )

      try {
        const data = (await fetchJSON('https://api.tavily.com/extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            urls: batchUrls,
            extract_depth: 'advanced'
          })
        })) as {
          results?: Array<{
            url?: string
            raw_content?: string
            content?: string
          }>
          failed_results?: Array<{ url?: string }>
        }

        const results = data.results ?? []
        if (!results.length) {
          console.warn(
            `[paper-library] Empty Tavily response for batch ${batchNum} (round ${attempt + 1})`
          )
          continue
        }

        for (const result of results) {
          const resultUrl = pickString(result.url)
          const rawContent =
            pickString(result.raw_content) ?? pickString(result.content) ?? ''

          if (!resultUrl) continue

          let matchedUrl = resultUrl
          let matchedPaper = urlToPaper.get(resultUrl) ?? null

          if (!matchedPaper) {
            for (const originalUrl of batchUrls) {
              if (urlsMatch(originalUrl, resultUrl)) {
                matchedUrl = originalUrl
                matchedPaper = urlToPaper.get(originalUrl) ?? null
                break
              }
            }
          }

          if (!matchedPaper) continue

          if (remainingUrls.includes(matchedUrl)) {
            remainingUrls = remainingUrls.filter(url => url !== matchedUrl)
          }

          const abstract = extractAbstractFromTavilyContent(rawContent, source)
          matchedPaper.abstract = abstract

          if (abstract) {
            papersWithAbs.push(matchedPaper)
          } else {
            papersWithoutAbs.push(matchedPaper)
          }
        }
      } catch (error) {
        console.warn(
          `[paper-library] Tavily batch ${batchNum} API error (round ${attempt + 1}): ${getErrorMessage(
            error
          )}`
        )
      }
    }
  }

  if (remainingUrls.length) {
    for (const url of remainingUrls) {
      const paper = urlToPaper.get(url)
      if (!paper) continue
      paperFailed.push(paper)
      console.warn(
        `[paper-library] Tavily API failed after ${maxRetries} attempts for URL: ${url}`
      )
    }
  }

  return {
    papersWithAbs,
    papersWithoutAbs,
    paperFailed
  }
}

function decodeOpenAlexAbstract(invertedIndex: Record<string, number[]>): string {
  if (!invertedIndex) return ''

  const wordPositions: Array<{ word: string; position: number }> = []
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      wordPositions.push({ word, position: pos })
    }
  }

  wordPositions.sort((a, b) => a.position - b.position)
  return wordPositions.map(w => w.word).join(' ')
}

async function resolveOpenAlexAbstractBatch(papers: Array<RecordLike>) {
  const papersWithAbs: Array<RecordLike> = []
  const papersWithoutAbs: Array<RecordLike> = []
  const paperFailed: Array<RecordLike> = []

  // Filter papers that already have abstracts or have no DOI
  const remainingPapers: Array<RecordLike> = []
  for (const paper of papers) {
    if (pickString(paper.abstract)) {
      papersWithAbs.push(paper)
      continue
    }

    const rawDoi = pickString(paper.doi)
    const doi = rawDoi ? rawDoi.replace(/^https?:\/\/doi\.org\//, '') : undefined

    if (!doi) {
      papersWithoutAbs.push(paper)
      continue
    }

    remainingPapers.push(paper)
  }

  if (remainingPapers.length === 0) {
    return { papersWithAbs, papersWithoutAbs, paperFailed }
  }

  // Split into batches of up to 50 DOIs (conservative limit, OpenAlex allows 100)
  const BATCH_SIZE = 50
  for (let i = 0; i < remainingPapers.length; i += BATCH_SIZE) {
    const batch = remainingPapers.slice(i, i + BATCH_SIZE)

    // Build pipe-separated DOI list
    const doiList = batch
      .map(p => {
        const raw = pickString(p.doi)
        return raw ? raw.replace(/^https?:\/\/doi\.org\//, '') : null
      })
      .filter(Boolean)
      .join('|')

    if (!doiList) {
      papersWithoutAbs.push(...batch)
      continue
    }

    console.log(`[paper-library] OpenAlex fetching batch of ${batch.length} DOIs`)

    try {
      const url = `https://api.openalex.org/works?filter=doi:${encodeURIComponent(doiList)}&select=id,doi,abstract_inverted_index&per_page=100`
      const data = await fetchJSON(url, {
        headers: { Accept: 'application/json' }
      })
      const results = data.results ?? []

      // Map result DOIs to their normalized form
      const resultByDoi = new Map<string, typeof results[0]>()
      for (const work of results) {
        if (work.doi) {
          const cleanDoi = work.doi.replace(/^https?:\/\/doi\.org\//, '')
          resultByDoi.set(cleanDoi, work)
          // Also try without any DOI prefix
          const bareDoi = cleanDoi.startsWith('10.') ? cleanDoi : undefined
          if (bareDoi && bareDoi !== cleanDoi) {
            resultByDoi.set(bareDoi, work)
          }
        }
      }

      // Match each paper to its result
      for (const paper of batch) {
        const rawDoi = pickString(paper.doi)
        const doi = rawDoi ? rawDoi.replace(/^https?:\/\/doi\.org\//, '') : undefined

        if (!doi) {
          papersWithoutAbs.push(paper)
          continue
        }

        const work = resultByDoi.get(doi)

        if (work) {
          const abstract = decodeOpenAlexAbstract(work.abstract_inverted_index)

          if (abstract) {
            paper.abstract = abstract
            papersWithAbs.push(paper)
          } else {
            papersWithoutAbs.push(paper)
          }
        } else {
          papersWithoutAbs.push(paper)
        }
      }
    } catch (error) {
      console.warn(`[paper-library] OpenAlex batch fetch error:`, error)
      paperFailed.push(...batch)
    }
  }

  console.log(`[paper-library] OpenAlex results: ${papersWithAbs.length} with abstract, ${papersWithoutAbs.length} without, ${paperFailed.length} failed`)

  return { papersWithAbs, papersWithoutAbs, paperFailed }
}

async function saveFetchedPaper(
  pb: PocketBase,
  normalizedPaper: ReturnType<typeof normalizeIncomingPaper>,
  runId: string
) {
  if (!normalizedPaper) {
    return 'skipped' as const
  }

  const existing = await pb
    .collection(COLLECTION_NAMES.papers)
    .getFirstListItem(
      pb.filter('fingerprint = {:fingerprint}', {
        fingerprint: normalizedPaper.fingerprint
      })
    )
    .catch(() => null)

  const now = new Date().toISOString()
  const payload = {
    external_id: normalizedPaper.externalId,
    fingerprint: normalizedPaper.fingerprint,
    title: normalizedPaper.title,
    authors: normalizedPaper.authors,
    abstract: normalizedPaper.abstract,
    journal: normalizedPaper.journal,
    source: normalizedPaper.source,
    published_at: normalizedPaper.publishedAt,
    doi: normalizedPaper.doi,
    url: normalizedPaper.url,
    pdf_url: normalizedPaper.pdfUrl,
    keywords: normalizedPaper.keywords,
    raw_payload: normalizedPaper.rawPayload,
    fetch_run_id: runId,
    abstract_status: normalizedPaper.abstractStatus,
    last_seen_at: now
  }

  if (existing) {
    return 'skipped' as const
  }

  await pb.collection(COLLECTION_NAMES.papers).create({
    ...payload,
    fetched_at: now
  })

  return 'inserted' as const
}

// Load fingerprints from the most recent successful fetch run
async function getLastFetchRunFingerprints(pb: PocketBase): Promise<Set<string>> {
  try {
    // Get the most recent successful fetch run
    const lastRun = await pb.collection(COLLECTION_NAMES.pipelineRuns)
      .getFirstListItem(
        pb.filter('stage = "fetch" && status = "completed"', {}),
        { sort: '-finished_at', requestKey: 'last-fetch-run' }
      )
      .catch(() => null)

    if (!lastRun) {
      console.log('[paper-library] no previous successful fetch run found')
      return new Set()
    }

    // Get all papers from that run
    const papers = await pb.collection(COLLECTION_NAMES.papers)
      .getFullList({
        filter: pb.filter('fetch_run_id = {:runId}', { runId: lastRun.id }),
        fields: 'fingerprint'
      })
      .catch(() => [])

    const fingerprints = papers.map((p: RecordLike) => p.fingerprint).filter(Boolean)
    console.log(`[paper-library] loaded ${fingerprints.length} fingerprints from last fetch run ${lastRun.id}`)
    return new Set(fingerprints)
  } catch (error) {
    console.log('[paper-library] failed to load fingerprints from last fetch run:', error)
    return new Set()
  }
}

async function runFetchStage(pb: PocketBase, runId: string): Promise<RunStats> {
  const settings = await getFetchSettingsInternal(pb)
  const rssSources = parseRSSSources(settings.rssSources)
  const seenFingerprints = await getLastFetchRunFingerprints(pb)
  const failedFeeds: Array<{
    source: string
    url: string
    reason: string
  }> = []
  const failedPapers: Array<{
    source: string
    title: string
    reason: string
  }> = []
  let insertedCount = 0
  let updatedCount = 0
  let skippedCount = 0
  let failedCount = 0
  let processedTotal = 0

  for (const sourceConfig of rssSources) {
    throwIfRunCancelled(runId, 'fetch')

    for (const url of buildFeedUrls(sourceConfig.source, sourceConfig.categories)) {
      throwIfRunCancelled(runId, 'fetch')

      try {
        const xml = await runWithRetry(
          () => fetchText(url),
          `fetch feed ${sourceConfig.source} ${url}`
        )

        if (!looksLikeRSSDocument(xml)) {
          throw new Error('Feed response is not a valid RSS/Atom document')
        }

        const papers = parseRSSItems(xml, sourceConfig.source)

        // Deduplicate against previous fetch and within current batch
        const newPapers: typeof papers = []
        for (const paper of papers) {
          if (seenFingerprints.has(paper.fingerprint)) {
            skippedCount += 1
            continue
          }
          seenFingerprints.add(paper.fingerprint)
          newPapers.push(paper)
        }

        for (const paper of newPapers) {
          throwIfRunCancelled(runId, 'fetch')
          processedTotal += 1

          if (paper.abstract) {
            paper.abstractStatus = 'ready'
          } else if (!pickString(paper.abstract_status)) {
            paper.abstractStatus = 'missing'
          }

          try {
            const result = await saveFetchedPaper(pb, paper, runId)

            if (result === 'inserted') insertedCount += 1
            if (result === 'skipped') skippedCount += 1
          } catch (error) {
            failedCount += 1
            const reason = getErrorMessage(error)

            failedPapers.push({
              source: sourceConfig.source,
              title: paper.title,
              reason
            })
            console.error(
              `[paper-library] failed to save fetched paper ${paper.title}: ${reason}`
            )
          }
        }
      } catch (error) {
        failedCount += 1
        const reason = getErrorMessage(error)

        failedFeeds.push({
          source: sourceConfig.source,
          url,
          reason
        })
        console.error(
          `[paper-library] fetch feed failed for ${sourceConfig.source} ${url}: ${reason}`
        )
      }
    }
  }


  return {
    processedTotal,
    insertedCount,
    updatedCount,
    skippedCount,
    failedCount,
    details: {
      rssSources: settings.rssSources,
      failedFeeds,
      failedPapers: failedPapers.slice(0, 50)
    }
  }
}

async function fetchAllZoteroCollections(
  zoteroUserId: string,
  zoteroApiKey: string
) {
  const collections: Array<RecordLike> = []
  let start = 0

  while (true) {
    const response = (await fetchJSON(
      `https://api.zotero.org/users/${zoteroUserId}/collections?limit=100&start=${start}`,
      {
        headers: {
          Authorization: `Bearer ${zoteroApiKey}`,
          'Zotero-API-Version': '3'
        }
      }
    )) as Array<RecordLike>

    collections.push(...response)

    if (response.length < 100) break
    start += 100
  }

  return collections
}

async function fetchAllZoteroItems(zoteroUserId: string, zoteroApiKey: string) {
  const items: Array<RecordLike> = []
  let start = 0

  while (true) {
    const response = (await fetchJSON(
      `https://api.zotero.org/users/${zoteroUserId}/items?limit=100&start=${start}`,
      {
        headers: {
          Authorization: `Bearer ${zoteroApiKey}`,
          'Zotero-API-Version': '3'
        }
      }
    )) as Array<RecordLike>

    items.push(...response)

    if (response.length < 100) break
    start += 100
  }

  return items
}

function buildCollectionPathMap(collections: Array<RecordLike>) {
  const byKey = new Map<string, RecordLike>()

  for (const collection of collections) {
    if (typeof collection.key === 'string') {
      byKey.set(collection.key, collection)
    }
  }

  const resolvePath = (key: string): string => {
    const collection = byKey.get(key)

    if (!collection) return key

    const data = collection.data as RecordLike | undefined
    const name = pickString(data?.name) ?? key
    const parentKey = pickString(data?.parentCollection)

    if (!parentKey) return name

    return `${resolvePath(parentKey)}/${name}`
  }

  return resolvePath
}

async function refreshZoteroCache(
  pb: PocketBase,
  settings: DecryptedUserSettings
) {
  const existing = await pb.collection(COLLECTION_NAMES.zoteroCacheEntries).getFullList({
    filter: pb.filter('user = {:user}', {
      user: settings.userId
    }),
    sort: '-updated'
  })

  const newest = existing[0]?.updated ? dayjs(existing[0].updated) : null

  if (
    existing.length > 0 &&
    newest?.isValid() &&
    dayjs().diff(newest, 'hour') < ZOTERO_CACHE_TTL_HOURS
  ) {
    return existing as Array<RecordLike>
  }

  if (!settings.zoteroUserId || !settings.zoteroApiKey) {
    throw new Error('Zotero settings are incomplete')
  }

  const [collections, items] = await Promise.all([
    fetchAllZoteroCollections(settings.zoteroUserId, settings.zoteroApiKey),
    fetchAllZoteroItems(settings.zoteroUserId, settings.zoteroApiKey)
  ])

  const resolvePath = buildCollectionPathMap(collections)
  const filteredItems = items.filter(item => {
    const data = (item.data as RecordLike | undefined) ?? {}

    return (
      ['journalArticle', 'conferencePaper', 'preprint'].includes(
        pickString(data.itemType) ?? ''
      ) && !!pickString(data.abstractNote)
    )
  })

  for (const record of existing) {
    await pb.collection(COLLECTION_NAMES.zoteroCacheEntries).delete(String(record.id))
  }

  const cachedRecords: Array<RecordLike> = []

  for (const item of filteredItems) {
    const data = (item.data as RecordLike | undefined) ?? {}
    const collectionPaths = asStringArray(data.collections).map(collectionKey =>
      resolvePath(collectionKey)
    )

    const created = await pb.collection(COLLECTION_NAMES.zoteroCacheEntries).create({
      user: settings.userId,
      item_key: pickString(item.key) ?? buildFingerprint({
        title: pickString(data.title) ?? 'zotero',
        source: 'zotero'
      }),
      title: pickString(data.title),
      abstract: pickString(data.abstractNote),
      collections: collectionPaths,
      raw_payload: item
    })

    cachedRecords.push(created as unknown as RecordLike)
  }

  return cachedRecords
}

function computeCosineSimilarity(left: number[], right: number[]) {
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0
    const rightValue = right[index] ?? 0

    dot += leftValue * rightValue
    leftNorm += leftValue * leftValue
    rightNorm += rightValue * rightValue
  }

  if (!leftNorm || !rightNorm) return 0

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}

async function requestEmbeddings(
  baseUrl: string,
  apiKey: string,
  model: string,
  input: string[]
) {
  const batches = chunkArray(input, EMBEDDING_BATCH_SIZE)
  const allEmbeddings: number[][] = []

  for (const [index, batch] of batches.entries()) {
    const response = (await runWithRetry(
      () =>
        fetchJSON(
          `${baseUrl.replace(/\/$/, '')}/embeddings`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model,
              input: batch
            })
          },
          EMBEDDING_REQUEST_TIMEOUT_MS
        ),
      `request embeddings batch ${index + 1}/${batches.length}`,
      EMBEDDING_RETRY_LIMIT
    )) as {
      data?: Array<{
        embedding: number[]
      }>
    }

    allEmbeddings.push(...(response.data?.map(item => item.embedding) ?? []))
  }

  return allEmbeddings
}

function getCacheEntryKey(entry: RecordLike) {
  return pickString(entry.item_key) ?? buildFingerprint({
    title: pickString(entry.title) ?? 'zotero',
    source: 'zotero-cache'
  })
}

function getCacheEntryText(entry: RecordLike) {
  return pickString(entry.abstract) ?? pickString(entry.title) ?? ''
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }

  return chunks
}

async function ensureItemEmbeddings(
  pb: PocketBase,
  settings: DecryptedUserSettings,
  entries: Array<RecordLike>
) {
  const existing = await pb.collection(COLLECTION_NAMES.zoteroEmbeddingCache).getFullList({
    filter: pb.filter('user = {:user} && model = {:model}', {
      user: settings.userId,
      model: settings.embeddingModel
    })
  })

  const existingByKey = new Map<string, RecordLike>(
    existing.map((record: RecordLike) => [pickString(record.cache_key) ?? '', record])
  )
  const result = new Map<string, number[]>()
  const pending: Array<{
    key: string
    text: string
    payloadHash: string
    collectionKey: string
    existing?: RecordLike
  }> = []

  for (const entry of entries) {
    const key = getCacheEntryKey(entry)
    const text = getCacheEntryText(entry)
    const payloadHash = buildFingerprint({
      title: text,
      source: settings.embeddingModel
    })
    const existingRecord = existingByKey.get(key)
    const existingEmbedding = existingRecord?.embeddings

    if (
      existingRecord &&
      pickString(existingRecord.payload_hash) === payloadHash &&
      Array.isArray(existingEmbedding) &&
      (existingEmbedding as unknown[]).every(value => typeof value === 'number')
    ) {
      result.set(key, existingEmbedding as number[])
      continue
    }

    pending.push({
      key,
      text,
      payloadHash,
      collectionKey: asStringArray(entry.collections)[0] ?? '',
      existing: existingRecord
    })
  }

  for (const batch of chunkArray(pending, EMBEDDING_BATCH_SIZE)) {
    const embeddings = await requestEmbeddings(
      settings.aiBaseUrl,
      settings.aiApiKey!,
      settings.embeddingModel,
      batch.map(item => item.text)
    )

    for (const [index, item] of batch.entries()) {
      const embedding = embeddings[index] ?? []

      if (item.existing) {
        await pb.collection(COLLECTION_NAMES.zoteroEmbeddingCache).update(item.existing.id, {
          payload_hash: item.payloadHash,
          collection_key: item.collectionKey,
          embeddings: embedding
        })
      } else {
        await pb.collection(COLLECTION_NAMES.zoteroEmbeddingCache).create({
          user: settings.userId,
          model: settings.embeddingModel,
          cache_key: item.key,
          payload_hash: item.payloadHash,
          collection_key: item.collectionKey,
          embeddings: embedding
        })
      }

      result.set(item.key, embedding)
    }
  }

  return result
}

async function upsertUserState(
  pb: PocketBase,
  userId: string,
  paperId: string,
  data: Record<string, unknown>
) {
  const existing = await pb
    .collection(COLLECTION_NAMES.userPaperStates)
    .getFirstListItem(
      pb.filter('user = {:user} && paper = {:paper}', {
        user: userId,
        paper: paperId
      })
    )
    .catch(() => null)

  if (existing) {
    return pb.collection(COLLECTION_NAMES.userPaperStates).update(existing.id, data)
  }

  return pb.collection(COLLECTION_NAMES.userPaperStates).create({
    user: userId,
    paper: paperId,
    recommend_status: 'idle',
    enhance_status: 'idle',
    ...data
  })
}

async function runRecommendStage(
  pb: PocketBase,
  runId: string,
  settings: DecryptedUserSettings,
  rangeStart?: string,
  rangeEnd?: string
): Promise<RunStats> {
  throwIfRunCancelled(runId, 'recommend')

  if (!settings.zoteroUserId || !settings.zoteroApiKey) {
    throw new Error('Zotero settings are incomplete')
  }

  if (!settings.aiBaseUrl || !settings.aiApiKey) {
    throw new Error('AI base URL or API key is missing')
  }

  const papers = await pb.collection(COLLECTION_NAMES.papers).getFullList({
    sort: '-fetched_at'
  })

  const scopedPapers = papers.filter((paper: RecordLike) => {
    const fetchedAt = pickString(paper.fetched_at)

    if (!fetchedAt) return false
    if (rangeStart && dayjs(fetchedAt).isBefore(dayjs(rangeStart), 'day')) return false
    if (rangeEnd && dayjs(fetchedAt).isAfter(dayjs(rangeEnd).endOf('day'))) return false

    return true
  })

  const cacheEntries = await refreshZoteroCache(pb, settings)
  throwIfRunCancelled(runId, 'recommend')
  const collectionBuckets = new Map<string, Array<RecordLike>>()

  for (const entry of cacheEntries) {
    const collections = asStringArray(entry.collections)

    for (const collection of collections) {
      const current = collectionBuckets.get(collection) ?? []
      current.push(entry)
      collectionBuckets.set(collection, current)
    }
  }
  const states = await pb.collection(COLLECTION_NAMES.userPaperStates).getFullList({
    filter: pb.filter('user = {:user}', {
      user: settings.userId
    })
  })
  const statesByPaper = new Map<string, RecordLike>(
    states.map((state: RecordLike) => [String(state.paper), state])
  )
  const corpusHash = buildRecommendCorpusHash(cacheEntries)
  const skippedItems: Array<{
    paperId: string
    reason: string
  }> = []
  const candidateDescriptors: Array<{
    paper: RecordLike
    inputHash: string
  }> = []

  let skippedNoAbstract = 0
  let skippedAlreadyCompletedUnchanged = 0

  for (const paper of scopedPapers) {
    const paperId = String(paper.id)
    const state = statesByPaper.get(paperId)
    const abstract = getReadyAbstract(paper)

    if (!abstract) {
      skippedNoAbstract += 1
      skippedItems.push({
        paperId,
        reason: 'no_abstract'
      })
      continue
    }

    const inputHash = buildRecommendInputHash(abstract, settings, corpusHash)
    const existingState = statesByPaper.get(paperId)

    if (
      pickString(existingState?.recommend_status) === 'completed' &&
      pickString(existingState?.recommend_input_hash) === inputHash
    ) {
      skippedAlreadyCompletedUnchanged += 1
      skippedItems.push({
        paperId,
        reason: 'unchanged'
      })
      continue
    }

    candidateDescriptors.push({
      paper,
      inputHash
    })
  }

  const candidateTexts = candidateDescriptors.map(
    ({ paper }) => getReadyAbstract(paper) ?? pickString(paper.title) ?? ''
  )
  const candidateEmbeddings = await requestEmbeddings(
    settings.aiBaseUrl,
    settings.aiApiKey!,
    settings.embeddingModel,
    candidateTexts
  )
  throwIfRunCancelled(runId, 'recommend')
  const entryEmbeddings = await ensureItemEmbeddings(pb, settings, cacheEntries)

  let updatedCount = 0

  for (const [index, descriptor] of candidateDescriptors.entries()) {
    throwIfRunCancelled(runId, 'recommend')
    const { paper, inputHash } = descriptor
    const scoreBreakdown: Record<string, number> = {}

    for (const [collection, entries] of collectionBuckets.entries()) {
      const texts = entries
        .map(entry => pickString(entry.abstract))
        .filter((value): value is string => !!value)

      if (texts.length === 0) continue

      const corpusEmbeddings = entries
        .map(entry => entryEmbeddings.get(getCacheEntryKey(entry)))
        .filter((embedding): embedding is number[] => Array.isArray(embedding))

      if (corpusEmbeddings.length === 0) continue

      let weightedScore = 0
      let totalWeight = 0

      for (const [corpusIndex, embedding] of corpusEmbeddings.entries()) {
        const weight = 1 / (1 + Math.log10(corpusIndex + 1))
        weightedScore +=
          computeCosineSimilarity(candidateEmbeddings[index] ?? [], embedding) * weight
        totalWeight += weight
      }

      scoreBreakdown[collection] = totalWeight > 0 ? (weightedScore / totalWeight) * 10 : 0
    }

    const sortedCollections = Object.entries(scoreBreakdown).sort((left, right) => right[1] - left[1])
    const matchedCollections = sortedCollections
      .filter(([, score]) => score > 4)
      .map(([collection]) => collection)
    const scoreMax = sortedCollections[0]?.[1] ?? 0

    await upsertUserState(pb, settings.userId, String(paper.id), {
      score_max: scoreMax,
      score_breakdown: Object.fromEntries(sortedCollections),
      matched_collections:
        matchedCollections.length > 0
          ? matchedCollections
          : sortedCollections[0]
          ? [sortedCollections[0][0]]
          : [],
      recommend_input_hash: inputHash,
      recommend_status: 'completed',
      recommend_last_run_id: runId,
      recommend_last_reason: '',
      recommended_at: new Date().toISOString()
    })

    updatedCount += 1
  }

  return {
    processedTotal: candidateDescriptors.length,
    insertedCount: 0,
    updatedCount,
    skippedCount: skippedNoAbstract + skippedAlreadyCompletedUnchanged,
    failedCount: 0,
    details: {
      corpusSize: cacheEntries.length,
      skippedNoAbstract,
      skippedAlreadyCompletedUnchanged,
      skippedItems: skippedItems.slice(0, 50)
    }
  }
}

function sanitizeJSONString(raw: string) {
  let result = ''
  let inString = false
  let escaped = false

  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index]

    if (!inString) {
      result += character

      if (character === '"') {
        inString = true
      }

      continue
    }

    if (escaped) {
      const isUnicodeEscape =
        character === 'u' && /^[0-9a-fA-F]{4}$/.test(raw.slice(index + 1, index + 5))

      if (
        character === '"' ||
        character === '\\' ||
        character === '/' ||
        character === 'b' ||
        character === 'f' ||
        character === 'n' ||
        character === 'r' ||
        character === 't' ||
        isUnicodeEscape
      ) {
        result += character
      } else {
        result += `\\${character}`
      }

      escaped = false

      if (isUnicodeEscape) {
        result += raw.slice(index + 1, index + 5)
        index += 4
      }

      continue
    }

    if (character === '\\') {
      result += character
      escaped = true
      continue
    }

    result += character

    if (character === '"') {
      inString = false
    }
  }

  if (escaped) {
    result += '\\'
  }

  return result
}

function parseJSONResponse(content: string) {
  const fenced = content.match(/```json\s*([\s\S]*?)```/i)
  const objectLike = content.match(/\{[\s\S]*\}/)
  const raw = fenced?.[1] ?? objectLike?.[0] ?? content

  try {
    return JSON.parse(raw)
  } catch {
    return JSON.parse(sanitizeJSONString(raw))
  }
}

async function requestEnhancement(
  settings: DecryptedUserSettings,
  title: string,
  abstract: string
) {
  const response = (await fetchJSON(
    `${settings.aiBaseUrl.replace(/\/$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.aiApiKey}`
      },
      body: JSON.stringify({
        model: settings.aiModel,
        messages: [
          {
            role: 'system',
            content:
              'You summarize academic papers. Return only valid JSON with keys tldr, translated_title, translated_abstract. Do not use markdown fences or any extra prose. Do not include LaTeX, backslashes, or escaped math syntax in any field. Rewrite formulas in plain natural language.'
          },
          {
            role: 'user',
            content:
              `Target language: ${settings.outputLanguage}\n` +
              `Title: ${title}\nAbstract: ${abstract}\n` +
              'Return concise academic output as a single JSON object.'
          }
        ],
        response_format: {
          type: 'text'
        }
      })
    }
  )) as {
    choices?: Array<{
      message?: {
        content?: string
      }
    }>
  }

  const content = response.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('Empty completion response')
  }

  let parsed: RecordLike

  try {
    parsed = parseJSONResponse(content) as RecordLike
  } catch (error) {
    const preview = content.slice(0, 400)
    throw new Error(
      `Failed to parse enhancement JSON: ${getErrorMessage(error)}; response preview: ${preview}`
    )
  }

  return {
    tldr: pickString(parsed.tldr) ?? '',
    translatedTitle: pickString(parsed.translated_title, parsed.translatedTitle) ?? '',
    translatedAbstract:
      pickString(parsed.translated_abstract, parsed.translatedAbstract) ?? ''
  }
}

async function runEnhanceStage(
  pb: PocketBase,
  runId: string,
  settings: DecryptedUserSettings,
  rangeStart?: string,
  rangeEnd?: string
): Promise<RunStats> {
  throwIfRunCancelled(runId, 'enhance')

  if (!settings.aiBaseUrl || !settings.aiApiKey) {
    throw new Error('AI base URL or API key is missing')
  }

  const [papers, states] = await Promise.all([
    pb.collection(COLLECTION_NAMES.papers).getFullList({
      sort: '-fetched_at'
    }),
    pb.collection(COLLECTION_NAMES.userPaperStates).getFullList({
      filter: pb.filter('user = {:user}', {
        user: settings.userId
      })
    })
  ])

  const statesByPaper = new Map<string, RecordLike>(
    states.map((state: RecordLike) => [String(state.paper), state])
  )
  const scopedPapers = papers.filter((paper: RecordLike) => {
    const fetchedAt = pickString(paper.fetched_at)

    if (!fetchedAt) return false
    if (rangeStart && dayjs(fetchedAt).isBefore(dayjs(rangeStart), 'day')) return false
    if (rangeEnd && dayjs(fetchedAt).isAfter(dayjs(rangeEnd).endOf('day'))) return false

    return true
  })
  const candidateDescriptors: Array<{
    paper: RecordLike
    inputHash: string
  }> = []
  const failedItems: Array<{
    paperId: string
    title: string
    reason: string
  }> = []
  let updatedCount = 0
  let failedCount = 0
  let skippedNoStateOrNoAbstract = 0
  let skippedBelowThreshold = 0
  let skippedAlreadyCompletedUnchanged = 0

  for (const paper of scopedPapers) {
    const paperId = String(paper.id)
    const state = statesByPaper.get(paperId)
    const abstract = getReadyAbstract(paper)

    if (!state || !abstract) {
      skippedNoStateOrNoAbstract += 1
      continue
    }

    if ((asNumber(state.score_max) ?? 0) < settings.enhanceThreshold) {
      skippedBelowThreshold += 1
      continue
    }

    const inputHash = buildEnhanceInputHash(abstract, settings)

    if (
      pickString(state.enhance_status) === 'completed' &&
      pickString(state.enhance_input_hash) === inputHash
    ) {
      skippedAlreadyCompletedUnchanged += 1
      continue
    }

    candidateDescriptors.push({
      paper,
      inputHash
    })
  }

  const skippedTotal =
    skippedNoStateOrNoAbstract +
    skippedBelowThreshold +
    skippedAlreadyCompletedUnchanged

  for (const descriptor of candidateDescriptors) {
    const paper = descriptor.paper
    const paperId = String(paper.id)
    const title = pickString(paper.title) ?? 'Untitled paper'

    try {
      throwIfRunCancelled(runId, 'enhance')
      const abstract = getReadyAbstract(paper) ?? ''
      const result = await requestEnhancement(
        settings,
        title,
        abstract
      )

      await upsertUserState(pb, settings.userId, paperId, {
        tldr: result.tldr,
        translated_title: result.translatedTitle,
        translated_abstract: result.translatedAbstract,
        enhance_input_hash: descriptor.inputHash,
        enhance_status: 'completed',
        enhance_last_run_id: runId,
        enhance_last_reason: '',
        enhanced_at: new Date().toISOString()
      })

      updatedCount += 1
    } catch (error) {
      if (isRunCancellationError(error)) {
        throw error
      }

      failedCount += 1
      const reason = getErrorMessage(error)

      console.error(
        `[paper-library] enhance failed for ${paperId} (${title}): ${reason}`
      )

      failedItems.push({
        paperId,
        title,
        reason
      })

      await upsertUserState(pb, settings.userId, paperId, {
        enhance_status: 'failed',
        enhance_last_run_id: runId,
        enhance_last_reason: reason
      })
    }
  }

  return {
    processedTotal: candidateDescriptors.length,
    insertedCount: 0,
    updatedCount,
    skippedCount: skippedTotal,
    failedCount,
    details: {
      failedItems: failedItems.slice(0, 20),
      skippedNoStateOrNoAbstract,
      skippedBelowThreshold,
      skippedAlreadyCompletedUnchanged
    }
  }
}

async function runAbstractStage(
  pb: PocketBase,
  runId: string,
  rangeStart?: string,
  rangeEnd?: string
): Promise<RunStats> {
  throwIfRunCancelled(runId, 'abstract')

  const fetchSettings = await getFetchSettingsInternal(pb)

  const papers = await pb.collection(COLLECTION_NAMES.papers).getFullList({
    sort: '-fetched_at',
    filter: pb.filter('abstract_status = "missing"', {})
  })

  const scopedPapers = papers.filter((paper: RecordLike) => {
    const fetchedAt = pickString(paper.fetched_at)

    if (!fetchedAt) return false
    if (rangeStart && dayjs(fetchedAt).isBefore(dayjs(rangeStart), 'day')) return false
    if (rangeEnd && dayjs(fetchedAt).isAfter(dayjs(rangeEnd).endOf('day'))) return false

    return true
  })

  let updatedCount = 0
  let failedCount = 0
  let skippedNoAbstract = 0
  let skippedNoDoi = 0
  let skippedApiFailed = 0

  const candidates = scopedPapers.filter((paper: RecordLike) => {
    const existingAbstract = pickString(paper.abstract)

    if (existingAbstract) {
      skippedNoAbstract += 1
      return false
    }

    return true
  })

  const resolvedPapers = new Map<string, { paper: RecordLike; usedApi: string }>()
  let remaining = [...candidates]

  throwIfRunCancelled(runId, 'abstract')

  if (fetchSettings.natureApiKey) {
    const natureCandidates = remaining.filter(
      (paper: RecordLike) => pickString(paper.source) === 'nature'
    )

    if (natureCandidates.length > 0) {
      const natureResult = await resolveNatureAbstractBatch(
        natureCandidates.map(paper => ({ ...paper, abstract: '' })),
        fetchSettings.natureApiKey,
        'nature'
      )

      for (const paper of natureResult.papersWithAbs) {
        resolvedPapers.set(String(paper.id), {
          paper,
          usedApi: 'nature'
        })
      }
    }
  }

  remaining = remaining.filter(paper => !resolvedPapers.has(String(paper.id)))

  throwIfRunCancelled(runId, 'abstract')

  if (remaining.length > 0) {
    const openAlexCandidates = remaining.filter((paper: RecordLike) => !!pickString(paper.doi))
    skippedNoDoi += remaining.length - openAlexCandidates.length

    if (openAlexCandidates.length > 0) {
      const openAlexResult = await resolveOpenAlexAbstractBatch(
        openAlexCandidates.map(paper => ({ ...paper, abstract: '' }))
      )

      for (const paper of openAlexResult.papersWithAbs) {
        resolvedPapers.set(String(paper.id), {
          paper,
          usedApi: 'openalex'
        })
      }
    }
  }

  remaining = candidates.filter(paper => !resolvedPapers.has(String(paper.id)))

  throwIfRunCancelled(runId, 'abstract')

  if (remaining.length > 0 && fetchSettings.tavilyApiKey) {
    const groups = new Map<string, Array<RecordLike>>()

    for (const paper of remaining) {
      const source = pickString(paper.source) ?? 'generic'
      const group = groups.get(source) ?? []
      group.push({ ...paper, abstract: '' })
      groups.set(source, group)
    }

    for (const [source, group] of groups) {
      throwIfRunCancelled(runId, 'abstract')

      const tavilyResult = await resolveTavilyAbstractBatch(
        group,
        fetchSettings.tavilyApiKey,
        source
      )

      for (const paper of tavilyResult.papersWithAbs) {
        resolvedPapers.set(String(paper.id), {
          paper,
          usedApi: 'tavily'
        })
      }
    }
  }

  remaining = candidates.filter(paper => !resolvedPapers.has(String(paper.id)))
  skippedApiFailed = remaining.length

  for (const { paper, usedApi } of resolvedPapers.values()) {
    try {
      await pb.collection(COLLECTION_NAMES.papers).update(String(paper.id), {
        abstract: pickString(paper.abstract) ?? '',
        abstract_status: 'ready'
      })
      updatedCount += 1
      console.log(
        `[paper-library] Abstract filled via ${usedApi} for ${String(paper.id)}: ${pickString(paper.title) ?? 'Untitled paper'}`
      )
    } catch (error) {
      failedCount += 1
      console.error(
        `[paper-library] abstract persistence failed for ${String(paper.id)} (${pickString(paper.title) ?? 'Untitled paper'}): ${getErrorMessage(error)}`
      )
    }
  }

  return {
    processedTotal: candidates.length,
    insertedCount: 0,
    updatedCount,
    skippedCount: skippedNoAbstract + skippedNoDoi + skippedApiFailed,
    failedCount,
    details: {
      skippedNoAbstract,
      skippedNoDoi,
      skippedApiFailed
    }
  }
}

async function executeStage(
  pb: PocketBase,
  stage: RunStageId,
  triggeredBy: RunTriggerId,
  params: {
    userId?: string
    rangeStart?: string
    rangeEnd?: string
  }
) {
  await prepareStageExecution(pb, stage, {
    userId: params.userId
  })

  const run = await startRun(pb, {
    stage,
    scope: (stage === 'fetch' || stage === 'abstract') ? 'global' : 'user',
    triggeredBy,
    userId: params.userId,
    rangeStart: params.rangeStart,
    rangeEnd: params.rangeEnd
  })

  try {
    let stats: RunStats

    if (stage === 'fetch') {
      stats = await runFetchStage(pb, run.id)
    } else if (stage === 'recommend') {
      const settings = await getUserSettingsInternal(pb, params.userId!)
      stats = await runRecommendStage(
        pb,
        run.id,
        settings,
        params.rangeStart,
        params.rangeEnd
      )
    } else if (stage === 'enhance') {
      const settings = await getUserSettingsInternal(pb, params.userId!)
      stats = await runEnhanceStage(
        pb,
        run.id,
        settings,
        params.rangeStart,
        params.rangeEnd
      )
    } else if (stage === 'abstract') {
      stats = await runAbstractStage(
        pb,
        run.id,
        params.rangeStart,
        params.rangeEnd
      )
    } else {
      const _exhaustive: never = stage
      throw new Error(`Unknown stage: ${_exhaustive}`)
    }

    throwIfRunCancelled(String(run.id), stage)
    await finishRun(pb, run.id, 'completed', stats)

    return run.id
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pipeline failed'

    await finishRun(
      pb,
      run.id,
      'failed',
      {
        processedTotal: 0,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 1
      },
      message
    )

    throw error
  } finally {
    cancelledRunIds.delete(String(run.id))
  }
}

function buildDefaultRange(days: number) {
  return {
    rangeStart: dayjs().subtract(days, 'day').startOf('day').toISOString(),
    rangeEnd: dayjs().endOf('day').toISOString()
  }
}

export async function triggerStages(
  pb: PocketBase,
  userId: string,
  input: TriggerStagesInput,
  triggeredBy: RunTriggerId
) {
  const normalizedStages = input.stages.filter(stage => RUN_STAGE_IDS.includes(stage))
  const resultIds: string[] = []

  for (const stage of normalizedStages) {
    if (stage === 'fetch') {
      resultIds.push(await executeStage(pb, stage, triggeredBy, {}))
      continue
    }

    if (stage === 'abstract') {
      const settings = await getFetchSettingsInternal(pb)
      const fallback = buildDefaultRange(settings.abstractLookbackDays)

      resultIds.push(
        await executeStage(pb, stage, triggeredBy, {
          rangeStart: input.rangeStart ?? fallback.rangeStart,
          rangeEnd: input.rangeEnd ?? fallback.rangeEnd
        })
      )
      continue
    }

    const settings = await getUserSettingsInternal(pb, userId)
    const fallback =
      stage === 'recommend'
        ? buildDefaultRange(settings.recommendLookbackDays)
        : buildDefaultRange(settings.enhanceLookbackDays)

    resultIds.push(
      await executeStage(pb, stage, triggeredBy, {
        userId,
        rangeStart: input.rangeStart ?? fallback.rangeStart,
        rangeEnd: input.rangeEnd ?? fallback.rangeEnd
      })
    )
  }

  return resultIds
}

export async function listRuns(pb: PocketBase, userId: string) {
  const runs = await pb.collection(COLLECTION_NAMES.pipelineRuns).getFullList({
    filter: pb.filter('scope = "global" || user = {:user}', {
      user: userId
    }),
    sort: '-created'
  })

  return runs.slice(0, 40).map(
    (run: RecordLike) =>
      ({
        id: String(run.id),
        scope: String(run.scope),
        stage: String(run.stage),
        triggeredBy: String(run.triggered_by),
        status: String(run.status),
        rangeStart: pickString(run.range_start),
        rangeEnd: pickString(run.range_end),
        startedAt: pickString(run.started_at),
        finishedAt: pickString(run.finished_at),
        processedTotal: asNumber(run.processed_total) ?? 0,
        insertedCount: asNumber(run.inserted_count) ?? 0,
        updatedCount: asNumber(run.updated_count) ?? 0,
        skippedCount: asNumber(run.skipped_count) ?? 0,
        failedCount: asNumber(run.failed_count) ?? 0,
        errorSummary: pickString(run.error_summary),
        details: run.details,
        created: String(run.created)
      }) satisfies RunView
  )
}

export async function listActiveRuns(pb: PocketBase, userId: string) {
  const runs = await pb.collection(COLLECTION_NAMES.pipelineRuns).getFullList({
    filter: pb.filter(
      'status = "running" && (scope = "global" || user = {:user})',
      {
        user: userId
      }
    ),
    sort: '-created'
  })

  return runs.map((run: RecordLike) => ({
    id: String(run.id),
    stage: String(run.stage),
    scope: String(run.scope),
    startedAt: pickString(run.started_at) ?? String(run.created)
  }))
}

export async function getSchedulerPocketBase() {
  if (!schedulerPBPromise) {
    schedulerPBPromise = connectToPocketBase(validateEnvironmentVariables())
  }

  return schedulerPBPromise
}

export async function runScheduledStages(now = dayjs()) {
  console.log('[paper-library] scheduler tick at', now.format('YYYY-MM-DD HH:mm'))
  const pb = await getSchedulerPocketBase()
  await reconcileOrphanedRunningRunsOnStartup(pb)
  await recoverStaleRunningRuns(pb)
  const currentMinutes = now.hour() * 60 + now.minute()

  const hasReachedScheduledTime = (time: string) => {
    const [hoursPart, minutesPart] = time.split(':')
    const hours = Number.parseInt(hoursPart ?? '', 10)
    const minutes = Number.parseInt(minutesPart ?? '', 10)

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return false
    }

    return currentMinutes >= hours * 60 + minutes
  }

  const fetchSettings = await getFetchSettingsInternal(pb)
  console.log('[paper-library] fetchEnabled:', fetchSettings.fetchEnabled, 'fetchTime:', fetchSettings.fetchTime, 'lastKey:', fetchSettings.lastFetchScheduleKey)

  if (fetchSettings.fetchEnabled && hasReachedScheduledTime(fetchSettings.fetchTime)) {
    const scheduleKey = buildScheduleKey(now, fetchSettings.fetchTime)
    console.log('[paper-library] scheduleKey:', scheduleKey, 'shouldTrigger:', fetchSettings.lastFetchScheduleKey !== scheduleKey)

    if (fetchSettings.lastFetchScheduleKey !== scheduleKey) {
      await pb.collection(COLLECTION_NAMES.fetchSettings).update(fetchSettings.id, {
        last_fetch_schedule_key: scheduleKey
      })
      console.log('[paper-library] triggering fetch...')
      await executeStage(pb, 'fetch', 'scheduler', {})
    }
  }

  const userSettings = await pb.collection(COLLECTION_NAMES.userSettings).getFullList()

  if (fetchSettings.abstractEnabled && hasReachedScheduledTime(fetchSettings.abstractTime)) {
    const scheduleKey = buildScheduleKey(now, fetchSettings.abstractTime)

    if (fetchSettings.lastAbstractScheduleKey !== scheduleKey) {
      await pb.collection(COLLECTION_NAMES.fetchSettings).update(fetchSettings.id, {
        last_abstract_schedule_key: scheduleKey
      })
      const range = buildDefaultRange(fetchSettings.abstractLookbackDays)
      await executeStage(pb, 'abstract', 'scheduler', {
        rangeStart: range.rangeStart,
        rangeEnd: range.rangeEnd
      })
    }
  }

  for (const record of userSettings) {
    const userId = String(record.user)
    const settings = await getUserSettingsInternal(pb, userId)
    const legacyCompat = getLegacyAbstractUserSettingsCompat(record)

    if (settings.recommendEnabled && hasReachedScheduledTime(settings.recommendTime)) {
      const scheduleKey = buildScheduleKey(now, settings.recommendTime)

      if (settings.lastRecommendScheduleKey !== scheduleKey) {
        await pb.collection(COLLECTION_NAMES.userSettings).update(settings.id, {
          ...legacyCompat,
          last_recommend_schedule_key: scheduleKey
        })
        const range = buildDefaultRange(settings.recommendLookbackDays)
        await executeStage(pb, 'recommend', 'scheduler', {
          userId,
          rangeStart: range.rangeStart,
          rangeEnd: range.rangeEnd
        })
      }
    }

    if (settings.enhanceEnabled && hasReachedScheduledTime(settings.enhanceTime)) {
      const scheduleKey = buildScheduleKey(now, settings.enhanceTime)

      if (settings.lastEnhanceScheduleKey !== scheduleKey) {
        await pb.collection(COLLECTION_NAMES.userSettings).update(settings.id, {
          ...legacyCompat,
          last_enhance_schedule_key: scheduleKey
        })
        const range = buildDefaultRange(settings.enhanceLookbackDays)
        await executeStage(pb, 'enhance', 'scheduler', {
          userId,
          rangeStart: range.rangeStart,
          rangeEnd: range.rangeEnd
        })
      }
    }
  }
}
