import { forgeRouter } from '@lifeforge/server-utils'
import z from 'zod'

import forge from '../forge'
import { RUN_STAGE_IDS } from '../utils/constants'
import {
  getFetchSettingsView,
  getPersonalSettingsView,
  listActiveRuns,
  listRuns,
  triggerStages,
  updateFetchSettingsView,
  updatePersonalSettingsView
} from '../utils/pipeline'
import { ensureAuthenticatedUser } from '../utils/records'

const fetchGet = forge
  .query()
  .description('Get shared fetch settings')
  .input({})
  .callback(async ({ pb }) => getFetchSettingsView(pb.instance))

const fetchUpdate = forge
  .mutation()
  .description('Update shared fetch settings')
  .input({
    body: z.object({
      rssSources: z.string().min(1),
      fetchEnabled: z.boolean(),
      fetchTime: z.string().min(4),
      natureApiKey: z.string().optional(),
      tavilyApiKey: z.string().optional()
    })
  })
  .callback(async ({ pb, body }) => {
    const userId = ensureAuthenticatedUser(pb.instance)

    return updateFetchSettingsView(pb.instance, userId, body)
  })

const personalGet = forge
  .query()
  .description('Get personal pipeline settings')
  .input({})
  .callback(async ({ pb }) => {
    const userId = ensureAuthenticatedUser(pb.instance)

    return getPersonalSettingsView(pb.instance, userId)
  })

const personalUpdate = forge
  .mutation()
  .description('Update personal pipeline settings')
  .input({
    body: z.object({
      zoteroUserId: z.string(),
      zoteroApiKey: z.string().optional(),
      aiBaseUrl: z.string(),
      aiApiKey: z.string().optional(),
      aiModel: z.string(),
      embeddingModel: z.string(),
      outputLanguage: z.string(),
      enhanceThreshold: z.coerce.number(),
      recommendEnabled: z.boolean(),
      recommendTime: z.string(),
      enhanceEnabled: z.boolean(),
      enhanceTime: z.string(),
      recommendLookbackDays: z.coerce.number().min(1).max(365),
      enhanceLookbackDays: z.coerce.number().min(1).max(365)
    })
  })
  .callback(async ({ pb, body }) => {
    const userId = ensureAuthenticatedUser(pb.instance)

    return updatePersonalSettingsView(pb.instance, userId, body)
  })

const runsList = forge
  .query()
  .description('List recent pipeline runs')
  .input({})
  .callback(async ({ pb }) => {
    const userId = ensureAuthenticatedUser(pb.instance)

    return listRuns(pb.instance, userId)
  })

const runsActive = forge
  .query()
  .description('List active pipeline runs')
  .input({})
  .callback(async ({ pb }) => {
    const userId = ensureAuthenticatedUser(pb.instance)

    return listActiveRuns(pb.instance, userId)
  })

const runsTrigger = forge
  .mutation()
  .description('Trigger one or more pipeline stages')
  .input({
    body: z.object({
      stages: z.array(z.enum(RUN_STAGE_IDS)).min(1),
      rangeStart: z.string().optional(),
      rangeEnd: z.string().optional()
    })
  })
  .callback(async ({ pb, body }) => {
    const userId = ensureAuthenticatedUser(pb.instance)
    const runIds = await triggerStages(pb.instance, userId, body, 'manual')

    return {
      runIds
    }
  })

export default forgeRouter({
  settings: forgeRouter({
    fetch: forgeRouter({
      get: fetchGet,
      update: fetchUpdate
    }),
    personal: forgeRouter({
      get: personalGet,
      update: personalUpdate
    })
  }),
  runs: forgeRouter({
    list: runsList,
    active: runsActive,
    trigger: runsTrigger
  })
})
