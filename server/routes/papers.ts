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

const abstractReviewList = forge
  .query()
  .description('List papers for manual abstract review')
  .input({
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      perPage: z.coerce.number().min(1).max(100).default(20),
      source: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional()
    })
  })
  .callback(async ({ pb, query }) => {
    ensureAuthenticatedUser(pb.instance)

    const records = await pb.instance.collection(COLLECTION_NAMES.papers).getFullList({
      sort: '-fetched_at,-published_at,-updated'
    })

    const filtered = records.filter(record => {
      const source = String(record.source ?? '')
      const fetchedAt = String(record.fetched_at ?? '')
      const fetchedDate = fetchedAt.slice(0, 10)

      if (query.source && source !== query.source) {
        return false
      }

      if (query.dateFrom && (!fetchedDate || fetchedDate < query.dateFrom)) {
        return false
      }

      if (query.dateTo && (!fetchedDate || fetchedDate > query.dateTo)) {
        return false
      }

      return true
    })

    const start = (query.page - 1) * query.perPage

    return {
      page: query.page,
      perPage: query.perPage,
      totalItems: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / query.perPage)),
      items: filtered.slice(start, start + query.perPage).map(record => ({
        id: String(record.id),
        title: String(record.title ?? 'Untitled paper'),
        url: typeof record.url === 'string' ? record.url : '',
        abstract: typeof record.abstract === 'string' ? record.abstract : '',
        source: typeof record.source === 'string' ? record.source : '',
        fetchedAt: typeof record.fetched_at === 'string' ? record.fetched_at : ''
      }))
    }
  })

const abstractReviewUpdate = forge
  .mutation()
  .description('Update one paper abstract manually')
  .input({
    body: z.object({
      id: z.string(),
      abstract: z.string().max(6000)
    })
  })
  .callback(async ({ pb, body }) => {
    ensureAuthenticatedUser(pb.instance)

    const record = await pb.instance.collection(COLLECTION_NAMES.papers).getOne(body.id)

    await pb.instance.collection(COLLECTION_NAMES.papers).update(record.id, {
      abstract: body.abstract.trim(),
      abstract_status: body.abstract.trim() ? 'ready' : 'missing'
    })

    return {
      success: true
    }
  })

export default {
  list,
  detail,
  filtersMeta,
  abstractReview: {
    list: abstractReviewList,
    update: abstractReviewUpdate
  }
}
