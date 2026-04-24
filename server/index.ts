import { forgeRouter } from '@lifeforge/server-utils'

import detail from './routes/papers'
import favorites from './routes/favorites'
import imports from './routes/imports'
import pipeline from './routes/pipeline'
import semanticScholar from './routes/semanticScholar'
import { startPipelineScheduler } from './utils/scheduler'

startPipelineScheduler()

export default forgeRouter({
  papers: {
    list: detail.list,
    detail: detail.detail,
    filters: {
      meta: detail.filtersMeta
    },
    abstractReview: detail.abstractReview,
    import: imports,
    favorites
  },
  pipeline,
  semanticScholar
})
