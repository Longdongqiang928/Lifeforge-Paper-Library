import { forgeRouter } from '@lifeforge/server-utils'
import z from 'zod'

import forge from '../forge'
import { ensureAuthenticatedUser, ingestPapers } from '../utils/papers'

const upsert = forge
  .mutation()
  .description('Upsert a single paper through the API')
  .input({
    body: z.object({
      paper: z.any(),
      source: z.string().optional()
    })
  })
  .callback(async ({ pb, body }) => {
    const userId = ensureAuthenticatedUser(pb)

    return ingestPapers({
      pb,
      userId,
      papers: [body.paper],
      type: 'api',
      source: body.source,
      filename: 'api-upsert'
    })
  })

const bulkUpsert = forge
  .mutation()
  .description('Upsert multiple papers through the API')
  .input({
    body: z.object({
      papers: z.array(z.any()),
      source: z.string().optional()
    })
  })
  .callback(async ({ pb, body }) => {
    const userId = ensureAuthenticatedUser(pb)

    return ingestPapers({
      pb,
      userId,
      papers: body.papers,
      type: 'api',
      source: body.source,
      filename: 'api-bulk-upsert'
    })
  })

export default forgeRouter({
  upsert,
  bulkUpsert
})
