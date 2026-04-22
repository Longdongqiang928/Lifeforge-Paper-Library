import { forgeRouter } from '@lifeforge/server-utils'

import detail from './routes/papers'
import favorites from './routes/favorites'
import imports from './routes/imports'
import pipeline from './routes/pipeline'
import { startPipelineScheduler } from './utils/scheduler'

startPipelineScheduler()

export default forgeRouter({
  papers: {
    list: detail.list,
    detail: detail.detail,
    filters: {
      meta: detail.filtersMeta
    },
    import: imports,
    favorites
  },
  pipeline
})
