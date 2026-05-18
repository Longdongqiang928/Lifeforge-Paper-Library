import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, EmptyStateScreen, ModuleHeader, WithQuery } from 'lifeforge-ui'
import { Icon } from '@iconify/react'
import { toast } from 'react-toastify'
import { Link, useParams } from 'shared'

import PaperDetailContent from '@/components/PaperDetailContent'
import forgeAPI from '@/utils/forgeAPI'
import {
  MODULE_BASE_PATH,
  MODULE_ROUTE_KEY
} from '@/utils/module'

function PaperDetailPage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const paperId = params.id

  const paperQuery = useQuery(
    forgeAPI.papers.detail
      .input({
        id: paperId ?? ''
      })
      .queryOptions({
        enabled: !!paperId,
        queryKey: [MODULE_ROUTE_KEY, 'papers', 'detail', paperId]
      })
  )

  const toggleFavoriteMutation = useMutation(
    forgeAPI.papers.favorites.toggle.mutationOptions({
      onSuccess: data => {
        toast.success(data.isFavorite ? 'Added to favorites' : 'Removed from favorites')
        queryClient.invalidateQueries({
          queryKey: [MODULE_ROUTE_KEY]
        })
      },
      onError: error => {
        toast.error(error instanceof Error ? error.message : 'Failed to update favorite')
      }
    })
  )

  if (!paperId) {
    return (
      <EmptyStateScreen
        icon="tabler:file-off"
        message={{
          title: 'Paper not found',
          description: 'The requested paper id is missing from the route.'
        }}
      />
    )
  }

  return (
    <WithQuery query={paperQuery}>
      {paper => (
        <>
          <ModuleHeader
            actionButton={
              <Button
                as={Link}
                icon="tabler:arrow-left"
                to={MODULE_BASE_PATH}
                variant="secondary"
              >
                Back
              </Button>
            }
            icon="tabler:file-description"
            title="Paper Detail"
          />

          <div className="from-custom-500/5 via-component-bg-lighter/30 to-component-bg mb-6 rounded-xl border bg-gradient-to-br p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-custom-500/20 border-custom-500/30 flex size-10 shrink-0 items-center justify-center rounded-xl border">
                <Icon className="text-custom-500 size-5" icon="tabler:book-open" />
              </div>
              <div>
                <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Reading view</p>
                <p className="text-sm">Standalone detail page with full metadata and abstract</p>
              </div>
            </div>
          </div>

          <PaperDetailContent
            favoriteLoading={toggleFavoriteMutation.isPending}
            paper={paper}
            onToggleFavorite={() => {
              toggleFavoriteMutation.mutate({
                paperId: paper.id,
                folderId: paper.favoriteFolderId
              })
            }}
          />
        </>
      )}
    </WithQuery>
  )
}

export default PaperDetailPage
