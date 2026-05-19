import { lazy } from 'react'
import type { ModuleConfig } from 'shared'

export default {
  routes: {
    '/': lazy(() => import('@/pages/PaperListPage')),
    '/abstract-review': lazy(() => import('@/pages/AbstractReviewPage')),
    '/favorites': lazy(() => import('@/pages/FavoritesPage')),
    '/import': lazy(() => import('@/pages/ImportPage')),
    '/run': lazy(() => import('@/pages/RunPage')),
    '/settings': lazy(() => import('@/pages/SettingsPage')),
    '/:id': lazy(() => import('@/pages/PaperDetailPage'))
  },
  widgets: [
    () => import('@/widgets/PipelineStatusWidget')
  ],
  clearQueryOnUnmount: true
} satisfies ModuleConfig
