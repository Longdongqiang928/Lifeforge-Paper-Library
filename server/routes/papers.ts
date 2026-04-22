import z from 'zod'

import forge from '../forge'
import { COLLECTION_NAMES } from '../utils/constants'
import {
  applyPaperFilters,
  buildFiltersMeta,
  ensureAuthenticatedUser,
  getFavoriteFolderMap,
  getUserStateMap,
  mapPaperDetail
} from '../utils/records'

function splitCSV(value?: string) {
  if (!value) return []

  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

const list = forge
  .query()
  .description('List imported papers with search and filters')
  .input({
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      perPage: z.coerce.number().min(1).max(100).default(24),
      query: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      sources: z.string().optional(),
      journals: z.string().optional(),
      collections: z.string().optional(),
      favoritesOnly: z.enum(['true', 'false']).optional(),
      hasAbstractOnly: z.enum(['true', 'false']).optional(),
      sort: z.enum(['fetched_desc', 'published_desc', 'score_desc']).optional()
    })
  })
  .callback(async ({ pb, query }) => {
    const userId = ensureAuthenticatedUser(pb.instance)

    const [records, favoriteFolderMap, userStateMap] = await Promise.all([
      pb.instance.collection(COLLECTION_NAMES.papers).getFullList(),
      getFavoriteFolderMap(pb.instance, userId),
      getUserStateMap(pb.instance, userId)
    ])

    const filtered = applyPaperFilters(records, userStateMap, favoriteFolderMap, {
      query: query.query,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      sources: splitCSV(query.sources),
      journals: splitCSV(query.journals),
      collections: splitCSV(query.collections),
      favoritesOnly: query.favoritesOnly === 'true',
      hasAbstractOnly: query.hasAbstractOnly !== 'false',
      sort: query.sort ?? 'fetched_desc'
    })

    const start = (query.page - 1) * query.perPage
    const items = filtered
      .slice(start, start + query.perPage)
      .map(({ paper }) => paper)

    return {
      page: query.page,
      perPage: query.perPage,
      totalItems: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / query.perPage)),
      items
    }
  })

const detail = forge
  .query()
  .description('Get a single paper detail record')
  .input({
    query: z.object({
      id: z.string()
    })
  })
  .callback(async ({ pb, query: { id } }) => {
    const userId = ensureAuthenticatedUser(pb.instance)

    const [record, favoriteFolderMap, userStateMap] = await Promise.all([
      pb.instance.collection(COLLECTION_NAMES.papers).getOne(id),
      getFavoriteFolderMap(pb.instance, userId),
      getUserStateMap(pb.instance, userId)
    ])

    return mapPaperDetail(record, userStateMap.get(id), favoriteFolderMap.get(id))
  })

const filtersMeta = forge
  .query()
  .description('Get available paper filter values')
  .input({})
  .callback(async ({ pb }) => {
    const userId = ensureAuthenticatedUser(pb.instance)

    const [records, userStateMap] = await Promise.all([
      pb.instance.collection(COLLECTION_NAMES.papers).getFullList(),
      getUserStateMap(pb.instance, userId)
    ])

    return buildFiltersMeta(records, userStateMap)
  })

export default {
  list,
  detail,
  filtersMeta
}
