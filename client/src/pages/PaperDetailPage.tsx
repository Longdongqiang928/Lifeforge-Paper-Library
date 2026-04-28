import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, EmptyStateScreen, ModuleHeader, WithQuery } from 'lifeforge-ui'
import { toast } from 'react-toastify'
import { Link, useParams } from 'shared'

import ModuleSubnav from '@/components/ModuleSubnav'
import PaperDetailContent from '@/components/PaperDetailContent'
import forgeAPI from '@/utils/forgeAPI'
import {
  MODULE_BASE_PATH,
  MODULE_NAMESPACE,
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
            namespace={MODULE_NAMESPACE}
            title="paperDetailPage"
          />
          <ModuleSubnav />

          <Card className="border-bg-500/10 from-component-bg-lighter to-component-bg mb-6 border bg-gradient-to-br">
            <div className="space-y-2">
              <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Standalone detail</p>
              <h2 className="text-3xl leading-tight font-semibold">Reading view</h2>
              <p className="text-bg-500 text-sm leading-7">This fallback route keeps the same content hierarchy as the modal reading panel.</p>
            </div>
          </Card>

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
