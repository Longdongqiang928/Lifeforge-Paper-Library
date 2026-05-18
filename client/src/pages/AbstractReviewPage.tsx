import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Button,
  DateInput,
  EmptyStateScreen,
  ModuleHeader,
  Pagination,
  SidebarDivider,
  SidebarItem,
  SidebarTitle,
  SidebarWrapper,
  TagChip,
  TextAreaInput,
  WithQuery
} from 'lifeforge-ui'
import { Icon } from '@iconify/react'
import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { Link } from 'shared'

import forgeAPI from '@/utils/forgeAPI'
import { MODULE_BASE_PATH, MODULE_NAMESPACE, MODULE_ROUTE_KEY } from '@/utils/module'
import type { AbstractReviewItem, AbstractReviewListResponse } from '@/utils/types'

function ReviewCard({
  item,
  onSave
}: {
  item: AbstractReviewItem
  onSave: (input: { id: string; abstract: string }) => Promise<void>
}) {
  const [abstract, setAbstract] = useState(item.abstract)
  const [isEditing, setIsEditing] = useState(false)

  const normalizeAbstract = (value: string) => value.replace(/[\r\n]+/g, '')

  useEffect(() => {
    setAbstract(normalizeAbstract(item.abstract))
  }, [item.abstract, item.id])

  const isDirty = abstract !== item.abstract

  return (
    <div className="group flex gap-4 overflow-hidden rounded-xl border bg-component-bg shadow-sm transition-shadow hover:shadow-md">
      {/* Left color strip */}
      <div className="bg-emerald-500 w-1 shrink-0 rounded-l-[11px]" />

      <div className="flex min-w-0 flex-1 items-start gap-4 py-4 pr-5">
        <div className="bg-emerald-500/20 border-emerald-500/30 flex size-10 shrink-0 items-center justify-center rounded-lg border">
          <Icon className="text-emerald-500 size-5" icon="tabler:file-text" />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <h3 className="truncate text-base font-semibold">{item.title}</h3>
              {item.url ? (
                <a
                  className="text-custom-500 hover:text-custom-500/80 inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
                  href={item.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Icon className="size-3.5" icon="tabler:external-link" />
                  <span className="truncate">{item.url}</span>
                </a>
              ) : (
                <p className="text-bg-500 text-sm">No source URL is stored for this paper.</p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {item.source && (
                <TagChip icon="tabler:rss" label={item.source} variant="outlined" />
              )}
              {item.fetchedAt && (
                <span className="text-bg-500 text-xs whitespace-nowrap">
                  {new Date(item.fetchedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <button
                className="text-bg-500 hover:text-bg flex items-center gap-1 text-xs font-medium transition-colors"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Icon
                  className={`size-3.5 transition-transform ${isEditing ? 'rotate-90' : ''}`}
                  icon="tabler:chevron-right"
                />
                Abstract
                <span className="text-bg-400 font-normal">({abstract.length}/6000)</span>
              </button>
              <div className="flex items-center gap-1.5">
                {isDirty && (
                  <Button
                    icon="tabler:device-floppy"
                    onClick={() => onSave({ id: item.id, abstract })}
                  >
                    Save
                  </Button>
                )}
                <Button
                  icon="tabler:eraser"
                  variant="secondary"
                  onClick={() => onSave({ id: item.id, abstract: '' })}
                >
                  Clear
                </Button>
              </div>
            </div>
            {isEditing ? (
              <TextAreaInput
                className="min-h-40"
                placeholder="Review or edit the extracted abstract here"
                value={abstract}
                variant="plain"
                onChange={value => setAbstract(normalizeAbstract(value))}
              />
            ) : (
              <p className="text-bg-500 line-clamp-3 text-sm leading-relaxed">
                {abstract || 'No abstract available.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
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
  const sources = (filtersMetaQuery.data?.sources ?? []) as string[]
  const hasFilters = !!(dateFrom || dateTo || selectedSource)

  const resetFilters = () => {
    setDateFrom('')
    setDateTo('')
    setSelectedSource('')
  }

  return (
    <>
      <ModuleHeader
        actionButton={
          <Button as={Link} icon="tabler:arrow-left" to={MODULE_BASE_PATH} variant="secondary">
            Back
          </Button>
        }
        icon="tabler:file-search"
        title="Review"
        totalItems={data?.totalItems}
      />

      <div className="flex size-full min-h-0 flex-1">
        <SidebarWrapper>
          <SidebarItem
            active={!selectedSource}
            icon="tabler:list"
            label="All sources"
            namespace={MODULE_NAMESPACE}
            number={data?.totalItems}
            onClick={() => setSelectedSource('')}
          />
          <SidebarDivider />
          <SidebarTitle label="Sources" namespace={MODULE_NAMESPACE} />
          {sources.map(source => (
            <SidebarItem
              key={source}
              active={selectedSource === source}
              icon="tabler:rss"
              label={source}
              onCancelButtonClick={() => setSelectedSource('')}
              onClick={() => setSelectedSource(source)}
            />
          ))}
        </SidebarWrapper>

        <div className="relative z-10 flex h-full flex-1 flex-col xl:ml-8">
          {/* Controls bar */}
          <div className="mb-4 space-y-3">
            <h2 className="text-lg font-semibold">
              All Papers{data?.totalItems != null ? ` (${data.totalItems})` : ''}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <DateInput
                value={dateFrom ? dayjs(dateFrom).toDate() : null}
                variant="plain"
                onChange={value => {
                  setDateFrom(value ? dayjs(value).format('YYYY-MM-DD') : '')
                }}
              />
              <DateInput
                value={dateTo ? dayjs(dateTo).toDate() : null}
                variant="plain"
                onChange={value => {
                  setDateTo(value ? dayjs(value).format('YYYY-MM-DD') : '')
                }}
              />
              {hasFilters && (
                <Button icon="tabler:refresh" variant="secondary" onClick={resetFilters}>
                  Reset
                </Button>
              )}
            </div>
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
                    <div className="space-y-3">
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
        </div>
      </div>
    </>
  )
}

export default AbstractReviewPage
