import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, ModalHeader } from 'lifeforge-ui'
import { toast } from 'react-toastify'

import forgeAPI from '@/utils/forgeAPI'
import { MODULE_ROUTE_KEY } from '@/utils/module'
import type { FavoriteFolder } from '@/utils/types'

function DeleteFolderModal({
  onClose,
  data
}: {
  onClose: () => void
  data: {
    folder: FavoriteFolder
  }
}) {
  const queryClient = useQueryClient()

  const deleteFolderMutation = useMutation(
    forgeAPI.papers.favorites.folders.delete.mutationOptions({
      onSuccess: result => {
        toast.success(
          result.movedCount > 0
            ? `Folder deleted and ${result.movedCount} paper(s) moved to Default`
            : 'Folder deleted'
        )
        queryClient.invalidateQueries({
          queryKey: [MODULE_ROUTE_KEY]
        })
        onClose()
      },
      onError: error => {
        toast.error(error instanceof Error ? error.message : 'Failed to delete folder')
      }
    })
  )

  return (
    <div className="min-w-[min(34rem,90vw)] space-y-4">
      <ModalHeader icon="tabler:folder-x" title="Delete folder" onClose={onClose} />
      <Card className="space-y-2">
        <p className="font-medium">{data.folder.name}</p>
        <p className="text-bg-500 text-sm">
          Delete this folder and move its {data.folder.count} saved paper
          {data.folder.count === 1 ? '' : 's'} into the Default folder.
        </p>
      </Card>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          icon="tabler:trash"
          loading={deleteFolderMutation.isPending}
          onClick={() => {
            deleteFolderMutation.mutate({
              folderId: data.folder.id
            })
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  )
}

export default DeleteFolderModal
