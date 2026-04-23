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
  favoriteFolderId?: string | null
  recommendStatus: 'idle' | 'running' | 'completed' | 'failed'
  enhanceStatus: 'idle' | 'running' | 'completed' | 'failed'
  recommendedAt?: string
  enhancedAt?: string
}

export interface PaperListResponse {
  page: number
  perPage: number
  totalItems: number
  totalPages: number
  items: PaperListItem[]
}

export interface PaperListQueryInput {
  page: number
  perPage: number
  query?: string
  dateFrom?: string
  dateTo?: string
  sources?: string
  journals?: string
  collections?: string
  favoritesOnly?: 'true' | 'false'
  hasAbstractOnly?: 'true' | 'false'
  sort?: 'fetched_desc' | 'published_desc' | 'score_desc'
}

export interface PaperDetail extends PaperListItem {
  abstract?: string
  translatedAbstract?: string
  rawPayload?: unknown
  scoreBreakdown: Record<string, number>
}

export interface PaperFiltersMeta {
  sources: string[]
  journals: string[]
  collections: string[]
}

export interface AbstractReviewItem {
  id: string
  title: string
  url: string
  abstract: string
  source: string
  fetchedAt?: string
}

export interface AbstractReviewListResponse {
  page: number
  perPage: number
  totalItems: number
  totalPages: number
  items: AbstractReviewItem[]
}

export interface AbstractReviewListInput {
  page: number
  perPage: number
  source?: string
  dateFrom?: string
  dateTo?: string
}

export interface UpdateAbstractReviewInput {
  id: string
  abstract: string
}

export interface FavoriteFolder {
  id: string
  name: string
  papers: PaperDetail[]
  count: number
}

export interface FavoriteFoldersResponse {
  totalFavorites: number
  folders: FavoriteFolder[]
}

export interface FavoriteFolderSummary {
  id: string
  name: string
  sortOrder: number
}

export interface ImportBatch {
  id: string
  type: string
  source: string
  filename: string
  status: string
  total: number
  inserted: number
  updatedCount: number
  skipped: number
  failed: number
  errorLog: string
  created: string
}

export interface ImportMutationInput {
  content?: string
  source?: string
  file?: File
}

export interface ImportMutationResponse {
  batchId: string
  inserted: number
  updated: number
  skipped: number
  failed: number
}

export interface ToggleFavoriteInput {
  paperId: string
  folderId?: string
}

export interface ToggleFavoriteResponse {
  isFavorite: boolean
  favoriteFolderId: string | null
}

export interface MoveFavoriteInput {
  paperId: string
  folderId: string
}

export interface MoveFavoriteResponse {
  success: boolean
  favoriteFolderId: string
}

export interface CreateFavoriteFolderInput {
  name: string
}

export interface PipelineRun {
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

export interface ActivePipelineRun {
  id: string
  stage: string
  scope: string
  startedAt: string
}

export interface TriggerPipelineInput {
  stages: Array<'fetch' | 'recommend' | 'enhance'>
  rangeStart?: string
  rangeEnd?: string
}

export interface TriggerPipelineResponse {
  runIds: string[]
}

export interface FetchSettings {
  rssSources: string
  fetchEnabled: boolean
  fetchTime: string
  hasNatureApiKey: boolean
  hasTavilyApiKey: boolean
  updatedAt?: string
}

export interface PersonalPipelineSettings {
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

export interface UpdateFetchSettingsInput {
  rssSources: string
  fetchEnabled: boolean
  fetchTime: string
  natureApiKey?: string
  tavilyApiKey?: string
}

export interface UpdatePersonalSettingsInput {
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
