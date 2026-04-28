import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Button,
  Card,
  DateInput,
  EmptyStateScreen,
  ModuleHeader,
  Pagination,
  TagChip,
  TextAreaInput,
  WithQuery
} from 'lifeforge-ui'
import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'

import ModuleSubnav from '@/components/ModuleSubnav'
import forgeAPI from '@/utils/forgeAPI'
import { MODULE_NAMESPACE, MODULE_ROUTE_KEY } from '@/utils/module'
import type { AbstractReviewItem, AbstractReviewListResponse } from '@/utils/types'

function ReviewCard({
  item,
  onSave
}: {
  item: AbstractReviewItem
  onSave: (input: { id: string; abstract: string }) => Promise<void>
}) {
  const [abstract, setAbstract] = useState(item.abstract)

  const normalizeAbstract = (value: string) => value.replace(/[\r\n]+/g, '')

  useEffect(() => {
    setAbstract(normalizeAbstract(item.abstract))
  }, [item.abstract, item.id])

  const isDirty = abstract !== item.abstract

  return (
    <Card className="border-bg-500/10 bg-component-bg/60 backdrop-blur-md space-y-4 border shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <TagChip icon="tabler:rss" label={item.source || 'Unknown source'} variant="outlined" />
            {item.fetchedAt && (
              <TagChip
                icon="tabler:calendar-time"
                label={new Date(item.fetchedAt).toLocaleString()}
                variant="outlined"
              />
            )}
          </div>
          <h3 className="text-lg font-semibold leading-7">{item.title}</h3>
          {item.url ? (
            <a
              className="text-primary hover:text-primary/80 inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline"
              href={item.url}
              rel="noreferrer"
              target="_blank"
            >
              <span className="truncate">{item.url}</span>
              <span className="shrink-0 text-xs font-medium uppercase">Open</span>
            </a>
          ) : (
            <p className="text-bg-500 text-sm">No source URL is stored for this paper.</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            disabled={!isDirty}
            icon="tabler:device-floppy"
            onClick={() => onSave({ id: item.id, abstract })}
          >
            Save abstract
          </Button>
          <Button
            icon="tabler:eraser"
            variant="secondary"
            onClick={() => onSave({ id: item.id, abstract: '' })}
          >
            Clear abstract
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Abstract</p>
          <p className="text-bg-500 text-xs">{abstract.length} / 6000</p>
        </div>
        <TextAreaInput
          className="min-h-56"
          placeholder="Review or edit the extracted abstract here"
          value={abstract}
          variant="plain"
          onChange={value => setAbstract(normalizeAbstract(value))}
        />
      </div>
    </Card>
  )
}

function AbstractReviewPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedSource, setSelectedSource] = useState('')

  useEffect(() => {
    setPage(1)
  }, [dateFrom, dateTo, selectedSource])

  const listInput = {
    page,
    perPage: 20,
    source: selectedSource || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined
  }

  const reviewQuery = useQuery(
    forgeAPI.papers.abstractReview.list.input(listInput).queryOptions({
      queryKey: [MODULE_ROUTE_KEY, 'papers', 'abstractReview', listInput]
    })
  )

  const filtersMetaQuery = useQuery(
    forgeAPI.papers.filters.meta.queryOptions({
      queryKey: [MODULE_ROUTE_KEY, 'papers', 'filters']
    })
  )

  const updateMutation = useMutation(
    forgeAPI.papers.abstractReview.update.mutationOptions({
      onSuccess: () => {
        toast.success('Abstract updated')
        queryClient.invalidateQueries({
          queryKey: [MODULE_ROUTE_KEY, 'papers', 'abstractReview']
        })
        queryClient.invalidateQueries({
          queryKey: [MODULE_ROUTE_KEY, 'papers', 'detail']
        })
        queryClient.invalidateQueries({
          queryKey: [MODULE_ROUTE_KEY, 'papers', 'list']
        })
      },
      onError: error => {
        toast.error(error instanceof Error ? error.message : 'Failed to update abstract')
      }
    })
  )

  const data = reviewQuery.data as AbstractReviewListResponse | undefined

  return (
    <>
      <ModuleHeader
        icon="tabler:file-search"
        namespace={MODULE_NAMESPACE}
        title="abstractReviewPage"
        totalItems={data?.totalItems}
      />
      <ModuleSubnav />

      <div className="mb-6 space-y-4">
        <Card className="border-bg-500/10 bg-component-bg/60 backdrop-blur-md space-y-6 border shadow-sm transition-shadow hover:shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <TagChip
                  icon="tabler:edit"
                  label={`${data?.totalItems ?? 0} papers in current review set`}
                  variant="filled"
                />
                <TagChip
                  icon="tabler:external-link"
                  label="URLs open in a new tab"
                  variant="outlined"
                />
              </div>
              <h2 className="text-3xl leading-tight font-semibold">Abstract review queue</h2>
            </div>
            <Button
              icon="tabler:refresh"
              variant="secondary"
              onClick={() => {
                setDateFrom('')
                setDateTo('')
                setSelectedSource('')
              }}
            >
              Reset filters
            </Button>
          </div>

          <div className="border-bg-500/10 grid gap-6 border-t pt-6 xl:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Fetched time</p>
                <h3 className="text-lg font-semibold">Window</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-bg-500 block text-sm font-medium">Fetched from</label>
                  <DateInput
                    value={dateFrom ? dayjs(dateFrom).toDate() : null}
                    variant="plain"
                    onChange={value => {
                      setDateFrom(value ? dayjs(value).format('YYYY-MM-DD') : '')
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-bg-500 block text-sm font-medium">Fetched to</label>
                  <DateInput
                    value={dateTo ? dayjs(dateTo).toDate() : null}
                    variant="plain"
                    onChange={value => {
                      setDateTo(value ? dayjs(value).format('YYYY-MM-DD') : '')
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Metadata</p>
                <h3 className="text-lg font-semibold">Source</h3>
              </div>
              <WithQuery query={filtersMetaQuery}>
                {meta => (
                  <div className="flex flex-wrap gap-2">
                    <TagChip
                      icon="tabler:list"
                      label="All sources"
                      variant={!selectedSource ? 'filled' : 'outlined'}
                      onClick={() => setSelectedSource('')}
                    />
                    {(meta as { sources: string[] }).sources.map(source => (
                      <TagChip
                        key={source}
                        icon="tabler:rss"
                        label={source}
                        variant={selectedSource === source ? 'filled' : 'outlined'}
                        onClick={() => setSelectedSource(source)}
                      />
                    ))}
                  </div>
                )}
              </WithQuery>
            </div>
          </div>
        </Card>
      </div>

      <WithQuery query={reviewQuery}>
        {response => (
          <div className="space-y-5">
            {(response as AbstractReviewListResponse).items.length === 0 ? (
              <EmptyStateScreen
                icon="tabler:file-search"
                message={{
                  id: 'abstractReview',
                  namespace: MODULE_NAMESPACE
                }}
              />
            ) : (
              <>
                <div className="space-y-4">
                  {(response as AbstractReviewListResponse).items.map(item => (
                    <ReviewCard
                      key={item.id}
                      item={item}
                      onSave={async input => {
                        await updateMutation.mutateAsync(input)
                      }}
                    />
                  ))}
                </div>

                <div className="flex justify-end">
                  <Pagination
                    page={(response as AbstractReviewListResponse).page}
                    totalPages={(response as AbstractReviewListResponse).totalPages}
                    onPageChange={value => {
                      setPage(typeof value === 'function' ? value(page) : value)
                    }}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </WithQuery>
    </>
  )
}

export default AbstractReviewPage
