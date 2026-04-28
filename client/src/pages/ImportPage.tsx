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
import { useRef, useState } from 'react'
import { toast } from 'react-toastify'

import ModuleSubnav from '@/components/ModuleSubnav'
import forgeAPI from '@/utils/forgeAPI'
import {
  MODULE_NAMESPACE,
  MODULE_ROUTE_KEY
} from '@/utils/module'
import type { ImportBatch } from '@/utils/types'

function ImportBatchCard({ batch }: { batch: ImportBatch }) {
  return (
    <Card className="border-bg-500/10 bg-component-bg/60 backdrop-blur-md space-y-4 border shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">
            {batch.filename || batch.source || batch.type.toUpperCase()}
          </h3>
          <p className="text-bg-500 text-sm">{new Date(batch.created).toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="bg-component-bg-lighter rounded-full px-3 py-1 text-sm">
            {batch.status}
          </span>
          <span className="bg-component-bg-lighter rounded-full px-3 py-1 text-sm">
            {batch.type.toUpperCase()}
          </span>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <p className="text-bg-500 text-xs uppercase">Inserted</p>
          <p className="text-lg font-semibold">{batch.inserted}</p>
        </div>
        <div>
          <p className="text-bg-500 text-xs uppercase">Skipped</p>
          <p className="text-lg font-semibold">{batch.skipped}</p>
        </div>
        <div>
          <p className="text-bg-500 text-xs uppercase">Failed</p>
          <p className="text-lg font-semibold">{batch.failed}</p>
        </div>
        <div>
          <p className="text-bg-500 text-xs uppercase">Total</p>
          <p className="text-lg font-semibold">{batch.inserted + batch.skipped + batch.failed}</p>
        </div>
      </div>
      {batch.errorLog && (
        <div className="bg-bg-100 dark:bg-bg-900 rounded-lg p-3">
          <p className="text-bg-500 mb-2 text-xs uppercase">Error log</p>
          <pre className="overflow-x-auto text-xs whitespace-pre-wrap">
            {batch.errorLog}
          </pre>
        </div>
      )}
    </Card>
  )
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
      <ModuleHeader
        icon="tabler:file-import"
        namespace={MODULE_NAMESPACE}
        title="importPage"
      />
      <ModuleSubnav />

      <div className="space-y-6">
        <Card className="border-bg-500/10 bg-component-bg/60 backdrop-blur-md space-y-5 border shadow-sm transition-shadow hover:shadow-md">
          <div className="space-y-1">
            <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Import</p>
            <h2 className="text-2xl font-semibold">Bring external batches into the shared paper pool</h2>
            
          </div>

          {importNotice && (
            <div
              className={[
                'border-bg-500/15 component-bg-lighter rounded-xl border px-4 py-3 text-sm',
                importNotice.tone === 'success'
                  ? 'text-primary'
                  : importNotice.tone === 'error'
                    ? ''
                    : 'text-bg-500'
              ].join(' ')}
            >
              {importNotice.message}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="component-bg-lighter flex flex-col gap-4">
              <input
                ref={fileInputRef}
                accept=".json,.jsonl,application/json"
                className="hidden"
                type="file"
                onChange={event => {
                  setSelectedFile(event.currentTarget.files?.[0] ?? null)
                }}
              />
              <div>
                <h3 className="font-medium">Selected file</h3>
                <p className="text-bg-500 mt-1 text-sm">
                  {selectedFile?.name || 'No file selected yet'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  icon="tabler:upload"
                  onClick={() => {
                    fileInputRef.current?.click()
                  }}
                >
                  Choose file
                </Button>
                {selectedFile && (
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
                )}
              </div>
            </Card>

            <Card className="component-bg-lighter space-y-4">
              <TextInput
                label="Source label"
                placeholder="nature, arxiv, pnas..."
                value={source}
                variant="plain"
                onChange={setSource}
              />
              <TextAreaInput
                className="min-h-32"
                placeholder="Paste raw JSON or JSONL here"
                value={content}
                variant="plain"
                onChange={setContent}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  icon="tabler:braces"
                  loading={jsonImportMutation.isPending}
                  onClick={() => {
                    runImport('json')
                  }}
                >
                  Import JSON
                </Button>
                <Button
                  icon="tabler:file-code"
                  loading={jsonlImportMutation.isPending}
                  variant="secondary"
                  onClick={() => {
                    runImport('jsonl')
                  }}
                >
                  Import JSONL
                </Button>
              </div>
            </Card>
          </div>
        </Card>

        <Card className="border-bg-500/10 bg-component-bg/60 backdrop-blur-md space-y-4 overflow-hidden border shadow-sm transition-shadow hover:shadow-md">
          <div className="from-component-bg-lighter to-component-bg bg-gradient-to-br p-1">
            <div className="component-bg rounded-xl p-5">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Accepted content</p>
                  <h2 className="text-2xl font-semibold">Shared metadata plus your overlay fields</h2>
                  
                </div>
                <div className="component-bg-lighter rounded-full px-3 py-1 text-xs font-medium">
                  Current model
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Card className="component-bg-lighter space-y-1 p-4">
                  <p className="text-sm font-medium">Shared paper pool</p>
                  
                </Card>
                <Card className="component-bg-lighter space-y-1 p-4">
                  <p className="text-sm font-medium">Personal overlay</p>
                  
                </Card>
                <Card className="component-bg-lighter space-y-1 p-4">
                  <p className="text-sm font-medium">Duplicate skip</p>
                  
                </Card>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Accepted fields</h2>
            
          </div>
          
          <div className="bg-bg-100 dark:bg-bg-900 rounded-lg p-4 text-sm">
            <p className="font-medium">What is preserved</p>
            <p className="text-bg-500 mt-1">
              Imported `score`, `collections`, `TL;DR`, translated title, and translated abstract
              are attached to your personal overlay so the list and detail views can use them
              immediately.
            </p>
          </div>
        </Card>
      </div>

      <section className="mt-8 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Recent imports</h2>
            
          </div>
          <Button
            disabled={isImporting}
            icon="tabler:refresh"
            variant="secondary"
            onClick={() => {
              batchesQuery.refetch()
            }}
          >
            Refresh
          </Button>
        </div>

        <WithQuery query={batchesQuery}>
          {batches =>
            batches.length === 0 ? (
              <EmptyStateScreen
                icon="tabler:history-off"
                message={{
                  id: 'batches',
                  namespace: MODULE_NAMESPACE
                }}
              />
            ) : (
              <div className="space-y-4">
                {batches.map(batch => (
                  <ImportBatchCard key={batch.id} batch={batch} />
                ))}
              </div>
            )
          }
        </WithQuery>
      </section>
    </>
  )
}

export default ImportPage
