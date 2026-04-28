import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, EmptyStateScreen, ModuleHeader, WithQuery, useModalStore } from 'lifeforge-ui'
import { toast } from 'react-toastify'

import CreateFolderModal from '@/components/CreateFolderModal'
import MoveFavoriteModal from '@/components/MoveFavoriteModal'
import ModuleSubnav from '@/components/ModuleSubnav'
import PaperCard from '@/components/PaperCard'
import forgeAPI from '@/utils/forgeAPI'
import {
  MODULE_BASE_PATH,
  MODULE_NAMESPACE,
  MODULE_ROUTE_KEY
} from '@/utils/module'

function FavoritesPage() {
  const queryClient = useQueryClient()
  const { open } = useModalStore()

  const favoritesQuery = useQuery(
    forgeAPI.papers.favorites.list.queryOptions({
      queryKey: [MODULE_ROUTE_KEY, 'papers', 'favorites']
    })
  )

  const toggleFavoriteMutation = useMutation(
    forgeAPI.papers.favorites.toggle.mutationOptions({
      onSuccess: () => {
        toast.success('Favorite updated')
        queryClient.invalidateQueries({
          queryKey: [MODULE_ROUTE_KEY]
        })
      },
      onError: error => {
        toast.error(error instanceof Error ? error.message : 'Failed to update favorite')
      }
    })
  )

  return (
    <>
      <ModuleHeader
        actionButton={
          <Button
            icon="tabler:folder-plus"
            onClick={() => {
              open(CreateFolderModal, {})
            }}
          >
            New folder
          </Button>
        }
        icon="tabler:star"
        namespace={MODULE_NAMESPACE}
        title="favoritesPage"
        totalItems={favoritesQuery.data?.totalFavorites}
      />
      <ModuleSubnav />

      <WithQuery query={favoritesQuery}>
        {data =>
          data.totalFavorites === 0 ? (
            <EmptyStateScreen
              icon="tabler:stars-off"
              message={{
                id: 'favorites',
                namespace: MODULE_NAMESPACE
              }}
            />
          ) : (
            <div className="space-y-6">
              <div className="border-bg-500/10 from-component-bg to-component-bg-lighter rounded-2xl border bg-gradient-to-br p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Saved reading</p>
                    <h2 className="text-3xl leading-tight font-semibold">Curated folders for papers worth returning to</h2>
                    <p className="text-bg-500 text-sm leading-7">
                      Favorites stay grouped by folder, using the same reading cards as the main paper feed.
                    </p>
                  </div>
                  <div className="bg-component-bg-lighter rounded-full px-4 py-2 text-sm font-medium">
                    {data.totalFavorites} saved papers
                  </div>
                </div>
              </div>

              {data.folders
                .filter(folder => folder.count > 0)
                .map(folder => (
                  <section key={folder.id} className="space-y-4">
                    <div className="border-bg-500/10 flex items-end justify-between gap-4 border-b pb-3">
                      <div>
                        <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Folder</p>
                        <h2 className="text-2xl font-semibold">{folder.name}</h2>
                        <p className="text-bg-500 text-sm">{folder.count} saved papers</p>
                      </div>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      {folder.papers.map(paper => (
                        <PaperCard
                          key={paper.id}
                          detailTo={`${MODULE_BASE_PATH}/${paper.id}`}
                          favoriteLoading={
                            toggleFavoriteMutation.isPending &&
                            toggleFavoriteMutation.variables?.paperId === paper.id
                          }
                          paper={paper}
                          secondaryAction={
                            data.folders.length > 1 ? (
                              <Button
                                icon="tabler:arrows-exchange"
                                variant="secondary"
                                onClick={() => {
                                  open(MoveFavoriteModal, {
                                    currentFolderId: folder.id,
                                    folders: data.folders,
                                    paperId: paper.id
                                  })
                                }}
                              >
                                Move
                              </Button>
                            ) : undefined
                          }
                          onToggleFavorite={() => {
                            toggleFavoriteMutation.mutate({
                              paperId: paper.id,
                              folderId: folder.id
                            })
                          }}
                        />
                      ))}
                    </div>
                  </section>
                ))}
            </div>
          )
        }
      </WithQuery>
    </>
  )
}

export default FavoritesPage
