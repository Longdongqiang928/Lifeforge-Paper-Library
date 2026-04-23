import { createForgeProxy } from 'shared'

import { MODULE_API_ROUTE } from './module'
import type {
  AbstractReviewListInput,
  AbstractReviewListResponse,
  ActivePipelineRun,
  CreateFavoriteFolderInput,
  FavoriteFolderSummary,
  FavoriteFoldersResponse,
  FetchSettings,
  ImportBatch,
  ImportMutationInput,
  ImportMutationResponse,
  MoveFavoriteInput,
  MoveFavoriteResponse,
  PaperDetail,
  PaperFiltersMeta,
  PaperListQueryInput,
  PaperListResponse,
  PersonalPipelineSettings,
  PipelineRun,
  ToggleFavoriteInput,
  ToggleFavoriteResponse,
  TriggerPipelineInput,
  TriggerPipelineResponse,
  UpdateAbstractReviewInput,
  UpdateFetchSettingsInput,
  UpdatePersonalSettingsInput
} from './types'

declare const __PAPER_LIBRARY_API_HOST__: string | undefined

const apiHost = __PAPER_LIBRARY_API_HOST__ || import.meta.env.VITE_API_HOST

if (!apiHost) {
  throw new Error('Paper Library API host is not defined')
}

const proxy = createForgeProxy(apiHost, MODULE_API_ROUTE)

function withModuleRoute(route: string) {
  return `${MODULE_API_ROUTE}/${route}`
}

function withQueryParams<TInput extends object>(
  route: string,
  input: TInput
) {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue

    searchParams.set(key, String(value))
  }

  const query = searchParams.toString()

  return query ? `${route}?${query}` : route
}

function createQueryEndpoint<TOutput, TInput extends object>(
  route: string,
  input: TInput
) {
  return proxy.untyped<TOutput>(withQueryParams(withModuleRoute(route), input))
}

const forgeAPI = {
  papers: {
    list: {
      input: (input: PaperListQueryInput) =>
        createQueryEndpoint<PaperListResponse, PaperListQueryInput>('papers/list', input)
    },
    detail: {
      input: (input: { id: string }) =>
        createQueryEndpoint<PaperDetail, { id: string }>('papers/detail', input)
    },
    filters: {
      meta: proxy.untyped<PaperFiltersMeta>(withModuleRoute('papers/filters/meta'))
    },
    abstractReview: {
      list: {
        input: (input: AbstractReviewListInput) =>
          createQueryEndpoint<AbstractReviewListResponse, AbstractReviewListInput>(
            'papers/abstractReview/list',
            input
          )
      },
      update: proxy.untyped<{ success: boolean }, UpdateAbstractReviewInput>(
        withModuleRoute('papers/abstractReview/update')
      )
    },
    import: {
      batchStatus: proxy.untyped<ImportBatch[]>(withModuleRoute('papers/import/batchStatus')),
      json: proxy.untyped<ImportMutationResponse, ImportMutationInput>(
        withModuleRoute('papers/import/json')
      ),
      jsonl: proxy.untyped<ImportMutationResponse, ImportMutationInput>(
        withModuleRoute('papers/import/jsonl')
      )
    },
    favorites: {
      list: proxy.untyped<FavoriteFoldersResponse>(withModuleRoute('papers/favorites/list')),
      toggle: proxy.untyped<ToggleFavoriteResponse, ToggleFavoriteInput>(
        withModuleRoute('papers/favorites/toggle')
      ),
      move: proxy.untyped<MoveFavoriteResponse, MoveFavoriteInput>(
        withModuleRoute('papers/favorites/move')
      ),
      folders: {
        list: proxy.untyped<FavoriteFolderSummary[]>(
          withModuleRoute('papers/favorites/folders/list')
        ),
        create: proxy.untyped<FavoriteFolderSummary, CreateFavoriteFolderInput>(
          withModuleRoute('papers/favorites/folders/create')
        )
      }
    }
  },
  pipeline: {
    settings: {
      fetch: {
        get: proxy.untyped<FetchSettings>(withModuleRoute('pipeline/settings/fetch/get')),
        update: proxy.untyped<FetchSettings, UpdateFetchSettingsInput>(
          withModuleRoute('pipeline/settings/fetch/update')
        )
      },
      personal: {
        get: proxy.untyped<PersonalPipelineSettings>(
          withModuleRoute('pipeline/settings/personal/get')
        ),
        update: proxy.untyped<PersonalPipelineSettings, UpdatePersonalSettingsInput>(
          withModuleRoute('pipeline/settings/personal/update')
        )
      }
    },
    runs: {
      list: proxy.untyped<PipelineRun[]>(withModuleRoute('pipeline/runs/list')),
      active: proxy.untyped<ActivePipelineRun[]>(withModuleRoute('pipeline/runs/active')),
      trigger: proxy.untyped<TriggerPipelineResponse, TriggerPipelineInput>(
        withModuleRoute('pipeline/runs/trigger')
      )
    }
  }
}

export default forgeAPI
