import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Icon } from '@iconify/react'
import {
  Button,
  Card,
  EmptyStateScreen,
  ModuleHeader,
  TextAreaInput,
  TextInput,
  WithQuery
} from 'lifeforge-ui'
import { useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { Link } from 'shared'

import forgeAPI from '@/utils/forgeAPI'
import { MODULE_BASE_PATH, MODULE_NAMESPACE, MODULE_ROUTE_KEY } from '@/utils/module'
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
        const message = error instanceof Error ? error.message : 'JSON import failed'
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
        const message = error instanceof Error ? error.message : 'JSONL import failed'
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
      <ModuleHeader
        actionButton={
          <Button as={Link} icon="tabler:arrow-left" to={MODULE_BASE_PATH} variant="secondary">
            <span>Back</span>
          </Button>
        }
        icon="tabler:file-import"
        namespace={MODULE_NAMESPACE}
        title="importPage"
      />

      <div className="space-y-6">
        <div className="overflow-x-auto">
          <div className="grid min-w-[680px] gap-6" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
          <Card className="space-y-4 border border-bg-500/10 bg-component-bg/80 p-6 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Choose File</h2>
              <p className="text-bg-500 text-sm">JSON or JSONL batch files.</p>
            </div>

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
              className="flex min-h-64 cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-bg-500/20 bg-component-bg-lighter/40 p-8 text-center transition-colors hover:border-custom-500/40 hover:bg-custom-500/5"
              onClick={() => {
                fileInputRef.current?.click()
              }}
              onDragOver={event => {
                event.preventDefault()
              }}
              onDrop={event => {
                event.preventDefault()
                const file = event.dataTransfer.files?.[0]
                if (file) setSelectedFile(file)
              }}
            >
              <div className="flex size-14 items-center justify-center rounded-xl border border-custom-500/20 bg-custom-500/10">
                <Icon className="text-custom-500 size-7" icon="tabler:upload" />
              </div>
              <div>
                <p className="font-medium">Drag-and-drop</p>
                <p className="text-bg-500 mt-1 text-sm">or click to choose a file</p>
              </div>
            </div>

            {selectedFile && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-bg-500/10 bg-component-bg-lighter/50 px-4 py-3">
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
                  <span>Clear</span>
                </Button>
              </div>
            )}
          </Card>

          <Card className="space-y-4 border border-bg-500/10 bg-component-bg/80 p-6 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Paste Text</h2>
              <p className="text-bg-500 text-sm">Paste raw JSON or JSONL content.</p>
            </div>

            <TextAreaInput
              className="min-h-40"
              icon="tabler:clipboard-text"
              label="Import content"
              placeholder="Paste raw JSON or JSONL content here..."
              value={content}
              onChange={setContent}
            />

            <TextInput
              icon="tabler:rss"
              label="Source label"
              placeholder="nature, arxiv, pnas..."
              value={source}
              onChange={setSource}
            />

            <div className="flex flex-wrap justify-end gap-3">
              <Button
                disabled={isImporting || (!selectedFile && !content.trim())}
                icon="tabler:file-import"
                loading={jsonImportMutation.isPending}
                onClick={() => runImport('json')}
              >
                <span>Import JSON</span>
              </Button>
              <Button
                disabled={isImporting || (!selectedFile && !content.trim())}
                icon="tabler:file-code"
                loading={jsonlImportMutation.isPending}
                variant="secondary"
                onClick={() => runImport('jsonl')}
              >
                <span>Import JSONL</span>
              </Button>
            </div>
          </Card>
          </div>
        </div>

        {importNotice && (
          <div
            className={`rounded-2xl border px-5 py-3 text-sm ${
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

        <Card className="space-y-4 border border-bg-500/10 bg-component-bg/80 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Recent imports</h2>
              <p className="text-bg-500 text-sm">History, status, and batch outcomes.</p>
            </div>
            <Button
              disabled={isImporting}
              icon="tabler:refresh"
              variant="secondary"
              onClick={() => {
                void batchesQuery.refetch()
              }}
            >
              <span>Refresh</span>
            </Button>
          </div>

          <WithQuery query={batchesQuery}>
            {(batches: ImportBatch[]) =>
              batches.length === 0 ? (
                <EmptyStateScreen icon="tabler:history-off" message={{ id: 'batches', namespace: MODULE_NAMESPACE }} />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-bg-500/10">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-bg-500/10 bg-component-bg-lighter/50">
                          <th className="px-6 py-3 text-left text-xs font-semibold tracking-[0.12em] uppercase text-bg-500">Filename</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold tracking-[0.12em] uppercase text-bg-500">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold tracking-[0.12em] uppercase text-bg-500">Source</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold tracking-[0.12em] uppercase text-bg-500">Status</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold tracking-[0.12em] uppercase text-bg-500">Results</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-bg-500/5">
                        {batches.map((batch: ImportBatch) => (
                          <tr key={batch.id} className="transition-colors hover:bg-component-bg-lighter/40">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2.5">
                                <Icon className="text-bg-400 size-4 shrink-0" icon="tabler:file-text" />
                                <span className="truncate text-sm font-medium">
                                  {batch.filename || batch.source || batch.type.toUpperCase()}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm whitespace-nowrap text-bg-500">
                              {new Date(batch.created).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-sm whitespace-nowrap">
                              {batch.source || batch.type.toUpperCase()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  STATUS_COLORS[batch.status] || 'bg-custom-500/20 text-custom-500'
                                }`}
                              >
                                {batch.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="inline-flex items-center gap-2 text-xs">
                                <span className="font-medium text-emerald-500">{batch.inserted} in</span>
                                <span className="text-bg-400">|</span>
                                <span className="font-medium">{batch.skipped} skip</span>
                                <span className="text-bg-400">|</span>
                                <span className="font-medium text-red-500">{batch.failed} fail</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            }
          </WithQuery>
        </Card>
      </div>
    </>
  )
}

export default ImportPage
