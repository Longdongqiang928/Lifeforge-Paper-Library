import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, ModalHeader, TextInput } from 'lifeforge-ui'
import { useState } from 'react'
import { toast } from 'react-toastify'

import forgeAPI from '@/utils/forgeAPI'
import { MODULE_NAMESPACE, MODULE_ROUTE_KEY } from '@/utils/module'

function CreateFolderModal({
  onClose
}: {
  onClose: () => void
}) {
  const [name, setName] = useState('')

  const queryClient = useQueryClient()

  const createFolderMutation = useMutation(
    forgeAPI.papers.favorites.folders.create.mutationOptions({
      onSuccess: () => {
        toast.success('Folder created')
        queryClient.invalidateQueries({
          queryKey: [MODULE_ROUTE_KEY]
        })
        onClose()
      },
      onError: error => {
        toast.error(error instanceof Error ? error.message : 'Failed to create folder')
      }
    })
  )

  return (
    <div className="min-w-[min(32rem,90vw)] space-y-4">
      <ModalHeader
        icon="tabler:folder-plus"
        namespace={MODULE_NAMESPACE}
        title="Create folder"
        onClose={onClose}
      />
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
          disabled={!name.trim()}
          icon="tabler:plus"
          loading={createFolderMutation.isPending}
          onClick={() => {
            createFolderMutation.mutate({
              name: name.trim()
            })
          }}
        >
          Create
        </Button>
      </div>
    </div>
  )
}

export default CreateFolderModal
