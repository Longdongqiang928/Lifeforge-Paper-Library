import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  EmptyStateScreen,
  ModuleHeader,
  TextAreaInput,
  TextInput,
  WithQuery
} from 'lifeforge-ui'
import { Icon } from '@iconify/react'
import { useRef, useState } from 'react'
import { toast } from 'react-toastify'

import forgeAPI from '@/utils/forgeAPI'
import {
  MODULE_NAMESPACE,
  MODULE_ROUTE_KEY
} from '@/utils/module'
import type { ImportBatch } from '@/utils/types'

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-500/20 text-emerald-500',
  processing: 'bg-amber-500/20 text-amber-500',
  failed: 'bg-red-500/20 text-red-500'
}

function ImportPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [content, setContent] = useState('')
  const [source, setSource] = useState('')
  const [importNotice, setImportNotice] = useState<{
    tone: 'error' | 'info' | 'success'
    message: string
  } | null>(null)

  const batchesQuery = useQuery(
    forgeAPI.papers.import.batchStatus.queryOptions({
      queryKey: [MODULE_ROUTE_KEY, 'papers', 'import', 'batchStatus']
    })
  )

  const commonSuccess = (message: string) => {
    toast.success(message)
    setImportNotice({
      tone: 'success',
      message
    })
    setSelectedFile(null)
    setContent('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    queryClient.invalidateQueries({
      queryKey: [MODULE_ROUTE_KEY]
    })
  }

  const jsonImportMutation = useMutation(
    forgeAPI.papers.import.json.mutationOptions({
      onSuccess: () => {
        commonSuccess('JSON import completed')
      },
      onError: error => {
        const message =
          error instanceof Error ? error.message : 'JSON import failed'

        toast.error(message)
        setImportNotice({
          tone: 'error',
          message
        })
      }
    })
  )

  const jsonlImportMutation = useMutation(
    forgeAPI.papers.import.jsonl.mutationOptions({
      onSuccess: () => {
        commonSuccess('JSONL import completed')
      },
      onError: error => {
        const message =
          error instanceof Error ? error.message : 'JSONL import failed'

        toast.error(message)
        setImportNotice({
          tone: 'error',
          message
        })
      }
    })
  )

  const isImporting = jsonImportMutation.isPending || jsonlImportMutation.isPending

  const runImport = (type: 'json' | 'jsonl') => {
    if (!selectedFile && !content.trim()) {
      const message = 'Select a file or paste JSON content first'
      toast.error(message)
      setImportNotice({
        tone: 'error',
        message
      })
      return
    }

    setImportNotice({
      tone: 'info',
      message: type === 'json' ? 'Importing JSON...' : 'Importing JSONL...'
    })

    const payload = {
      content: content.trim() || undefined,
      file: selectedFile ?? undefined,
      source: source.trim() || undefined
    }

    if (type === 'json') {
      jsonImportMutation.mutate(payload)
      return
    }

    jsonlImportMutation.mutate(payload)
  }

  return (
    <>
      <ModuleHeader icon="tabler:file-import" title="Import" />

      <div className="space-y-8">
        {/* Import Tools - Two Column Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Drop Zone */}
          <Card className="from-component-bg-lighter/50 to-component-bg flex flex-col gap-4 bg-gradient-to-br p-6">
            <h3 className="text-lg font-semibold">Choose File</h3>
            <input
              ref={fileInputRef}
              accept=".json,.jsonl,application/json"
              className="hidden"
              type="file"
              onChange={event => {
                setSelectedFile(event.currentTarget.files?.[0] ?? null)
              }}
            />
            <div
              className="border-bg-500/20 flex flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-10 text-center transition-colors hover:border-custom-500/40 hover:bg-custom-500/5"
              onClick={() => {
                fileInputRef.current?.click()
              }}
              onDragOver={event => {
                event.preventDefault()
              }}
              onDrop={event => {
                event.preventDefault()
                const file = event.dataTransfer.files?.[0]
                if (file) {
                  setSelectedFile(file)
                }
              }}
            >
              <div className="bg-custom-500/20 border-custom-500/30 flex size-14 items-center justify-center rounded-xl border">
                <Icon className="text-custom-500 size-7" icon="tabler:cloud-upload" />
              </div>
              <div>
                <p className="font-medium">Drag-and-drop</p>
                <p className="text-bg-500 mt-1 text-sm">JSON or JSONL files</p>
              </div>
            </div>
            {selectedFile && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-bg-500 text-xs">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button
                  icon="tabler:trash"
                  variant="secondary"
                  onClick={() => {
                    setSelectedFile(null)
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                    }
                  }}
                >
                  Clear
                </Button>
              </div>
            )}
          </Card>

          {/* Paste Text */}
          <Card className="flex flex-col gap-4 p-6">
            <h3 className="text-lg font-semibold">Paste Text</h3>
            <TextAreaInput
              className="min-h-36 flex-1"
              placeholder="Paste raw JSON or JSONL content here..."
              value={content}
              variant="plain"
              onChange={setContent}
            />
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <TextInput
                  label="Source label"
                  placeholder="nature, arxiv, pnas..."
                  value={source}
                  variant="plain"
                  onChange={setSource}
                />
              </div>
              <Button
                disabled={isImporting || (!selectedFile && !content.trim())}
                icon="tabler:file-import"
                loading={jsonImportMutation.isPending}
                onClick={() => runImport('json')}
              >
                Import JSON
              </Button>
              <Button
                disabled={isImporting || (!selectedFile && !content.trim())}
                icon="tabler:file-code"
                loading={jsonlImportMutation.isPending}
                variant="secondary"
                onClick={() => runImport('jsonl')}
              >
                JSONL
              </Button>
            </div>
          </Card>
        </div>

        {/* Import Notice */}
        {importNotice && (
          <div
            className={`border rounded-xl px-5 py-3 text-sm ${
              importNotice.tone === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                : importNotice.tone === 'error'
                  ? 'border-red-500/30 bg-red-500/10 text-red-600'
                  : 'border-custom-500/30 bg-custom-500/10 text-custom-600'
            }`}
          >
            {importNotice.message}
          </div>
        )}

        {/* Recent Imports */}
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Recent Imports</h2>
              <p className="text-bg-500 mt-1 text-sm">Import history and batch status</p>
            </div>
            <Button
              disabled={isImporting}
              icon="tabler:refresh"
              variant="secondary"
              onClick={() => { void batchesQuery.refetch() }}
            >
              Refresh
            </Button>
          </div>

          <WithQuery query={batchesQuery}>
            {(batches: ImportBatch[]) =>
              batches.length === 0 ? (
                <EmptyStateScreen
                  icon="tabler:history-off"
                  message={{
                    id: 'batches',
                    namespace: MODULE_NAMESPACE
                  }}
                />
              ) : (
                <Card className="overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-bg-500/10">
                          <th className="text-bg-500 px-6 py-3 text-left text-xs font-semibold tracking-[0.12em] uppercase">
                            Filename
                          </th>
                          <th className="text-bg-500 px-6 py-3 text-left text-xs font-semibold tracking-[0.12em] uppercase">
                            Date
                          </th>
                          <th className="text-bg-500 px-6 py-3 text-left text-xs font-semibold tracking-[0.12em] uppercase">
                            Source
                          </th>
                          <th className="text-bg-500 px-6 py-3 text-left text-xs font-semibold tracking-[0.12em] uppercase">
                            Status
                          </th>
                          <th className="text-bg-500 px-6 py-3 text-right text-xs font-semibold tracking-[0.12em] uppercase">
                            Results
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-bg-500/5">
                        {batches.map((batch: ImportBatch) => (
                          <tr key={batch.id} className="hover:bg-component-bg-lighter/50 transition-colors">
                            <td className="px-6 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <Icon className="text-bg-400 size-4 shrink-0" icon="tabler:file-text" />
                                <span className="truncate text-sm font-medium">
                                  {batch.filename || batch.source || batch.type.toUpperCase()}
                                </span>
                              </div>
                            </td>
                            <td className="text-bg-500 px-6 py-3.5 text-sm whitespace-nowrap">
                              {new Date(batch.created).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-3.5 whitespace-nowrap">
                              <span className="text-sm">{batch.source || batch.type.toUpperCase()}</span>
                            </td>
                            <td className="px-6 py-3.5 whitespace-nowrap">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  STATUS_COLORS[batch.status] || 'bg-custom-500/20 text-custom-500'
                                }`}
                              >
                                {batch.status}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <div className="inline-flex items-center gap-3 text-xs">
                                <span className="text-emerald-500 font-medium">{batch.inserted} inserted</span>
                                <span className="text-bg-400">|</span>
                                <span className="text-amber-500 font-medium">{batch.skipped} skipped</span>
                                <span className="text-bg-400">|</span>
                                <span className="text-red-500 font-medium">{batch.failed} failed</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )
            }
          </WithQuery>
        </section>
      </div>
    </>
  )
}

export default ImportPage
