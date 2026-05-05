import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, ModalHeader, TextInput, WithQuery } from 'lifeforge-ui'
import { useState } from 'react'
import { toast } from 'react-toastify'

import forgeAPI from '@/utils/forgeAPI'
import { MODULE_ROUTE_KEY } from '@/utils/module'
import type { FavoriteFolderSummary } from '@/utils/types'

function SaveFavoriteModal({
  onClose,
  data
}: {
  onClose: () => void
  data: {
    paperId: string
    paperTitle: string
  }
}) {
  const queryClient = useQueryClient()
  const [newFolderName, setNewFolderName] = useState('')

  const foldersQuery = useQuery(
    forgeAPI.papers.favorites.folders.list.queryOptions({
      queryKey: [MODULE_ROUTE_KEY, 'papers', 'favorites', 'folders']
    })
  )

  const toggleFavoriteMutation = useMutation(
    forgeAPI.papers.favorites.toggle.mutationOptions({
      onSuccess: () => {
        toast.success('Added to favorites')
        queryClient.invalidateQueries({
          queryKey: [MODULE_ROUTE_KEY]
        })
        onClose()
      },
      onError: error => {
        toast.error(error instanceof Error ? error.message : 'Failed to add favorite')
      }
    })
  )

  const createFolderMutation = useMutation(
    forgeAPI.papers.favorites.folders.create.mutationOptions({
      onSuccess: folder => {
        queryClient.invalidateQueries({
          queryKey: [MODULE_ROUTE_KEY, 'papers', 'favorites', 'folders']
        })
        toggleFavoriteMutation.mutate({
          paperId: data.paperId,
          folderId: folder.id
        })
      },
      onError: error => {
        toast.error(error instanceof Error ? error.message : 'Failed to create folder')
      }
    })
  )

  return (
    <div className="min-w-[min(42rem,92vw)] space-y-4">
      <ModalHeader
        icon="tabler:star"
        title={<span>Save to favorites</span>}
        onClose={onClose}
      />

      <Card className="space-y-1">
        <p className="text-bg-500 text-sm">Choose where to save this paper.</p>
        <h3 className="text-lg font-semibold leading-7">{data.paperTitle}</h3>
      </Card>

      <WithQuery query={foldersQuery}>
        {(folders: FavoriteFolderSummary[]) => (
          <div className="space-y-3">
            <div className="space-y-3">
              {folders.map(folder => (
                <Card key={folder.id} className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-medium">{folder.name}</h3>
                    <p className="text-bg-500 text-sm">
                      {folder.isDefault ? 'Default folder' : 'Custom folder'}
                    </p>
                  </div>
                  <Button
                    icon="tabler:folder-plus"
                    loading={
                      toggleFavoriteMutation.isPending &&
                      toggleFavoriteMutation.variables?.paperId === data.paperId &&
                      toggleFavoriteMutation.variables?.folderId === folder.id
                    }
                    onClick={() => {
                      toggleFavoriteMutation.mutate({
                        paperId: data.paperId,
                        folderId: folder.id
                      })
                    }}
                  >
                    <span>Save here</span>
                  </Button>
                </Card>
              ))}
            </div>

            <Card className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Or create a new folder</p>
                <p className="text-bg-500 text-sm">
                  Create a new folder and save this paper into it immediately.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <TextInput
                  className="w-full"
                  placeholder="Reading later"
                  value={newFolderName}
                  variant="plain"
                  onChange={setNewFolderName}
                />
                <Button
                  disabled={!newFolderName.trim()}
                  icon="tabler:folder-plus"
                  loading={createFolderMutation.isPending}
                  onClick={() => {
                    createFolderMutation.mutate({
                      name: newFolderName.trim()
                    })
                  }}
                >
                  <span>Create and save</span>
                </Button>
              </div>
            </Card>
          </div>
        )}
      </WithQuery>
    </div>
  )
}

export default SaveFavoriteModal
