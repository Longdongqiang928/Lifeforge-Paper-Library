import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  EmptyStateScreen,
  ModuleHeader,
  SidebarDivider,
  SidebarItem,
  SidebarTitle,
  SidebarWrapper,
  WithQuery,
  useModalStore
} from 'lifeforge-ui'
import { Icon } from '@iconify/react'
import { useState } from 'react'
import { toast } from 'react-toastify'

import CreateFolderModal from '@/components/CreateFolderModal'
import DeleteFolderModal from '@/components/DeleteFolderModal'
import MoveFavoriteModal from '@/components/MoveFavoriteModal'
import PaperCard from '@/components/PaperCard'
import RenameFolderModal from '@/components/RenameFolderModal'
import forgeAPI from '@/utils/forgeAPI'
import {
  MODULE_BASE_PATH,
  MODULE_NAMESPACE,
  MODULE_ROUTE_KEY
} from '@/utils/module'

function FavoritesPage() {
  const queryClient = useQueryClient()
  const { open } = useModalStore()
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)

  const favoritesQuery = useQuery(
    forgeAPI.papers.favorites.list.queryOptions({
      queryKey: [MODULE_ROUTE_KEY, 'papers', 'favorites']
    })
  )

  const toggleFavoriteMutation = useMutation(
    forgeAPI.papers.favorites.toggle.mutationOptions({
      onSuccess: () => {
        toast.success('Favorite updated')
        queryClient.invalidateQueries({ queryKey: [MODULE_ROUTE_KEY] })
      },
      onError: error => {
        toast.error(error instanceof Error ? error.message : 'Failed to update favorite')
      }
    })
  )

  const folders = favoritesQuery.data?.folders ?? []
  const activeFolder = activeFolderId
    ? folders.find(f => f.id === activeFolderId) ?? folders[0]
    : folders[0]

  return (
    <>
      <ModuleHeader
        actionButton={
          <Button
            className="hidden md:flex"
            icon="tabler:folder-plus"
            onClick={() => open(CreateFolderModal, {})}
          >
            New folder
          </Button>
        }
        icon="tabler:star"
        title="Favorites"
        totalItems={favoritesQuery.data?.totalFavorites}
      />

      <WithQuery query={favoritesQuery}>
        {data =>
          data.folders.length === 0 ? (
            <EmptyStateScreen
              CTAButtonProps={{
                children: 'new',
                icon: 'tabler:folder-plus',
                onClick: () => open(CreateFolderModal, {})
              }}
              icon="tabler:stars-off"
              message={{ id: 'favorites', namespace: MODULE_NAMESPACE }}
            />
          ) : (
            <div className="flex min-h-0 w-full flex-1">
              {/* Sidebar */}
              <SidebarWrapper>
                <SidebarTitle
                  actionButton={{
                    icon: 'tabler:plus',
                    onClick: () => open(CreateFolderModal, {})
                  }}
                  label="folders"
                  namespace={MODULE_NAMESPACE}
                />
                {folders.map(folder => (
                  <SidebarItem
                    key={folder.id}
                    active={activeFolder?.id === folder.id}
                    icon={folder.isDefault ? 'tabler:star-filled' : 'tabler:folder'}
                    label={folder.name}
                    number={folder.count}
                    onClick={() => setActiveFolderId(folder.id)}
                  />
                ))}
                <SidebarDivider />
                <div className="bg-component-bg-lighter mx-2 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{data.totalFavorites}</p>
                  <p className="text-bg-500 text-xs">saved papers</p>
                </div>
              </SidebarWrapper>

              {/* Content */}
              <div className="flex h-full min-w-0 flex-1 flex-col xl:ml-8">
                {activeFolder && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-semibold">{activeFolder.name}</h2>
                        <p className="text-bg-500 mt-1 text-sm">
                          {activeFolder.count} saved paper{activeFolder.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {!activeFolder.isDefault && (
                        <div className="flex items-center gap-2">
                          <Button
                            icon="tabler:edit"
                            variant="secondary"
                            onClick={() => open(RenameFolderModal, { folder: activeFolder })}
                          >
                            Rename
                          </Button>
                          <Button
                            icon="tabler:trash"
                            variant="secondary"
                            onClick={() => open(DeleteFolderModal, { folder: activeFolder })}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeFolder && activeFolder.papers.length === 0 ? (
                  <Card className="border-dashed p-8 text-center">
                    <Icon className="text-bg-400 mx-auto mb-3 size-10" icon="tabler:file-off" />
                    <p className="font-medium">Empty folder</p>
                    <p className="text-bg-500 mt-1 text-sm">
                      Save papers into this folder to build a curated reading shelf.
                    </p>
                  </Card>
                ) : activeFolder ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {activeFolder.papers.map(paper => (
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
                                  currentFolderId: activeFolder.id,
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
                            folderId: activeFolder.id
                          })
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )
        }
      </WithQuery>
    </>
  )
}

export default FavoritesPage
