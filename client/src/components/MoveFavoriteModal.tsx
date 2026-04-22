import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, ModalHeader } from 'lifeforge-ui'
import { toast } from 'react-toastify'

import forgeAPI from '@/utils/forgeAPI'
import { MODULE_ROUTE_KEY } from '@/utils/module'
import type { FavoriteFolder } from '@/utils/types'

function MoveFavoriteModal({
  onClose,
  data
}: {
  onClose: () => void
  data: {
    paperId: string
    currentFolderId?: string
    folders: FavoriteFolder[]
  }
}) {
  const queryClient = useQueryClient()

  const moveFavoriteMutation = useMutation(
    forgeAPI.papers.favorites.move.mutationOptions({
      onSuccess: () => {
        toast.success('Favorite moved')
        queryClient.invalidateQueries({
          queryKey: [MODULE_ROUTE_KEY]
        })
        onClose()
      },
      onError: error => {
        toast.error(error instanceof Error ? error.message : 'Failed to move favorite')
      }
    })
  )

  const availableFolders = data.folders.filter(
    folder => folder.id !== data.currentFolderId
  )

  return (
    <div className="min-w-[min(36rem,90vw)] space-y-4">
      <ModalHeader
        icon="tabler:arrows-exchange"
        title="Move favorite"
        onClose={onClose}
      />
      {availableFolders.length === 0 ? (
        <Card>
          <p className="text-bg-500">
            Create another folder first, then you can move this paper into it.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {availableFolders.map(folder => (
            <Card key={folder.id} className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-medium">{folder.name}</h3>
                <p className="text-bg-500 text-sm">{folder.count} papers</p>
              </div>
              <Button
                icon="tabler:corner-right-down"
                loading={
                  moveFavoriteMutation.isPending &&
                  moveFavoriteMutation.variables?.paperId === data.paperId &&
                  moveFavoriteMutation.variables?.folderId === folder.id
                }
                onClick={() => {
                  moveFavoriteMutation.mutate({
                    paperId: data.paperId,
                    folderId: folder.id
                  })
                }}
              >
                Move
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default MoveFavoriteModal
