export const MODULE_ID = 'longdongqiang--paper-library'
export const MODULE_ROUTE_KEY = 'longdongqiang$paperLibrary'
export const MODULE_NAMESPACE = 'apps.longdongqiang__paperLibrary'
export const MODULE_BASE_PATH = '/longdongqiang--paper-library'

export const DEFAULT_FOLDER_NAME = 'Default'
export const PIPELINE_TICK_MS = 60_000
export const ZOTERO_CACHE_TTL_HOURS = 24
export const DEFAULT_ENHANCE_THRESHOLD = 3.6
export const DEFAULT_RECOMMEND_LOOKBACK_DAYS = 7
export const DEFAULT_ENHANCE_LOOKBACK_DAYS = 3
export const BATCH_STATUS_LIMIT = 12
export const IMPORT_TEXT_MAX_LENGTH = 6000
export const EMBEDDING_BATCH_SIZE = 32
export const RUN_WAIT_POLL_MS = 5_000
export const RUN_STALE_TIMEOUT_MS = 6 * 60 * 60_000

export const COLLECTION_NAMES = {
  papers: 'ldq_paperlib_papers',
  favoriteFolders: 'ldq_paperlib_folders',
  paperFavorites: 'ldq_paperlib_favorites',
  userPaperStates: 'ldq_paperlib_user_states',
  fetchSettings: 'ldq_paperlib_fetch_settings',
  userSettings: 'ldq_paperlib_user_settings',
  pipelineRuns: 'ldq_paperlib_runs',
  importBatches: 'ldq_paperlib_import_batches',
  zoteroCacheEntries: 'ldq_paperlib_zotero_cache',
  zoteroEmbeddingCache: 'ldq_paperlib_embed_cache'
} as const

export const RUN_STAGE_IDS = ['fetch', 'recommend', 'enhance'] as const
export type RunStageId = (typeof RUN_STAGE_IDS)[number]

export const RUN_STATUS_IDS = ['running', 'completed', 'failed'] as const
export type RunStatusId = (typeof RUN_STATUS_IDS)[number]

export const PROCESS_STATUS_IDS = [
  'idle',
  'running',
  'completed',
  'failed'
] as const
export type ProcessStatusId = (typeof PROCESS_STATUS_IDS)[number]

export const ABSTRACT_STATUS_IDS = [
  'pending',
  'found',
  'missing',
  'error'
] as const
export type AbstractStatusId = (typeof ABSTRACT_STATUS_IDS)[number]

export const RUN_TRIGGER_IDS = ['manual', 'scheduler'] as const
export type RunTriggerId = (typeof RUN_TRIGGER_IDS)[number]

export const RUN_SCOPE_IDS = ['global', 'user'] as const
export type RunScopeId = (typeof RUN_SCOPE_IDS)[number]

export const DEFAULT_FETCH_SETTINGS = {
  rssSources:
    'arxiv:physics+quant-ph+cond-mat+nlin,nature:nature+nphoton+ncomms+nphys+natrevphys+lsa+natmachintell,science:science+sciadv,optica:optica,aps:prl+prx+rmp',
  fetchEnabled: false,
  fetchTime: '08:00'
} as const

export const DEFAULT_USER_SETTINGS = {
  aiBaseUrl: '',
  aiModel: 'qwen3-30b-a3b-instruct-2507',
  embeddingModel: 'qwen3-embedding-8b-f16',
  outputLanguage: 'Chinese',
  enhanceThreshold: DEFAULT_ENHANCE_THRESHOLD,
  recommendEnabled: false,
  recommendTime: '09:00',
  enhanceEnabled: false,
  enhanceTime: '09:30',
  recommendLookbackDays: DEFAULT_RECOMMEND_LOOKBACK_DAYS,
  enhanceLookbackDays: DEFAULT_ENHANCE_LOOKBACK_DAYS
} as const
