import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, EmptyStateScreen, ModuleHeader, TagChip, WithQuery } from 'lifeforge-ui'
import { toast } from 'react-toastify'
import { Link, useParams } from 'shared'

import forgeAPI from '@/utils/forgeAPI'
import {
  MODULE_BASE_PATH,
  MODULE_NAMESPACE,
  MODULE_ROUTE_KEY
} from '@/utils/module'
import { formatAuthors, formatPaperDate } from '@/utils/papers'

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
              <div className="flex items-center gap-2">
                <Button
                  as={Link}
                  icon="tabler:arrow-left"
                  to={MODULE_BASE_PATH}
                  variant="secondary"
                >
                  Back
                </Button>
                <Button
                  icon={paper.isFavorite ? 'tabler:star-filled' : 'tabler:star'}
                  loading={toggleFavoriteMutation.isPending}
                  onClick={() => {
                    toggleFavoriteMutation.mutate({
                      paperId: paper.id,
                      folderId: paper.favoriteFolderId
                    })
                  }}
                >
                  {paper.isFavorite ? 'Saved' : 'Save'}
                </Button>
              </div>
            }
            icon="tabler:file-description"
            namespace={MODULE_NAMESPACE}
            title="paperDetailPage"
          />

          <div className="space-y-4">
            <Card className="space-y-4">
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold">
                  {paper.translatedTitle || paper.title}
                </h1>
                {paper.translatedTitle && paper.translatedTitle !== paper.title && (
                  <p className="text-bg-500 text-lg">{paper.title}</p>
                )}
                <p className="text-bg-500">{formatAuthors(paper.authors)}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {paper.fetchedAt && (
                  <TagChip
                    icon="tabler:database-import"
                    label={`Fetched ${formatPaperDate(paper.fetchedAt)}`}
                    variant="outlined"
                  />
                )}
                <TagChip icon="tabler:calendar" label={formatPaperDate(paper.publishedAt)} />
                {paper.source && <TagChip icon="tabler:rss" label={paper.source} variant="filled" />}
                {paper.journal && <TagChip icon="tabler:book" label={paper.journal} />}
                {paper.doi && <TagChip icon="tabler:fingerprint" label={paper.doi} />}
                {typeof paper.score === 'number' && (
                  <TagChip
                    icon="tabler:chart-bar"
                    label={`Score ${paper.score.toFixed(2)}`}
                    variant="filled"
                  />
                )}
              </div>

              {(paper.matchedCollections.length > 0 || paper.keywords.length > 0) && (
                <div className="space-y-2">
                  {paper.matchedCollections.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {paper.matchedCollections.map(collection => (
                        <TagChip
                          key={collection}
                          icon="tabler:folders"
                          label={collection}
                        />
                      ))}
                    </div>
                  )}
                  {paper.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {paper.keywords.map(keyword => (
                        <TagChip key={keyword} icon="tabler:hash" label={keyword} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {paper.url && (
                  <Button as="a" href={paper.url} icon="tabler:world" target="_blank">
                    Abstract
                  </Button>
                )}
                {paper.pdfUrl && (
                  <Button
                    as="a"
                    href={paper.pdfUrl}
                    icon="tabler:file-type-pdf"
                    target="_blank"
                    variant="secondary"
                  >
                    PDF
                  </Button>
                )}
              </div>
            </Card>

            {paper.tldr && (
              <Card className="space-y-2">
                <h2 className="text-xl font-semibold">TL;DR</h2>
                <p className="text-bg-500 leading-7">{paper.tldr}</p>
              </Card>
            )}

            {paper.translatedTitle && (
              <Card className="space-y-2">
                <h2 className="text-xl font-semibold">Translated title</h2>
                <p className="text-bg-500 leading-7">{paper.translatedTitle}</p>
              </Card>
            )}

            {paper.translatedAbstract && (
              <Card className="space-y-2">
                <h2 className="text-xl font-semibold">Translated abstract</h2>
                <p className="text-bg-500 leading-7">{paper.translatedAbstract}</p>
              </Card>
            )}

            {paper.abstract && (
              <Card className="space-y-2">
                <h2 className="text-xl font-semibold">Original abstract</h2>
                <p className="text-bg-500 leading-7">{paper.abstract}</p>
              </Card>
            )}
          </div>
        </>
      )}
    </WithQuery>
  )
}

export default PaperDetailPage
