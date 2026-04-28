import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, ModalHeader, TextInput } from 'lifeforge-ui'
import { useState } from 'react'
import { toast } from 'react-toastify'

import forgeAPI from '@/utils/forgeAPI'
import { MODULE_ROUTE_KEY } from '@/utils/module'
import type { FavoriteFolder } from '@/utils/types'

function RenameFolderModal({
  onClose,
  data
}: {
  onClose: () => void
  data: {
    folder: FavoriteFolder
  }
}) {
  const [name, setName] = useState(data.folder.name)
  const queryClient = useQueryClient()

  const renameFolderMutation = useMutation(
    forgeAPI.papers.favorites.folders.rename.mutationOptions({
      onSuccess: () => {
        toast.success('Folder renamed')
        queryClient.invalidateQueries({
          queryKey: [MODULE_ROUTE_KEY]
        })
        onClose()
      },
      onError: error => {
        toast.error(error instanceof Error ? error.message : 'Failed to rename folder')
      }
    })
  )

  return (
    <div className="min-w-[min(32rem,90vw)] space-y-4">
      <ModalHeader icon="tabler:edit" title="Rename folder" onClose={onClose} />
      <TextInput
        autoFocus
        className="w-full"
        label="Folder name"
        placeholder="Reading later"
        value={name}
        variant="plain"
        onChange={setName}
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!name.trim() || name.trim() === data.folder.name}
          icon="tabler:check"
          loading={renameFolderMutation.isPending}
          onClick={() => {
            renameFolderMutation.mutate({
              folderId: data.folder.id,
              name: name.trim()
            })
          }}
        >
          Save
        </Button>
      </div>
    </div>
  )
}

export default RenameFolderModal
