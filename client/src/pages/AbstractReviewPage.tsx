import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Icon } from '@iconify/react'
import {
  Button,
  Card,
  EmptyStateScreen,
  ModuleHeader,
  Pagination,
  Scrollbar,
  SidebarItem,
  SidebarTitle,
  TagChip,
  TextAreaInput,
  WithQuery
} from 'lifeforge-ui'
import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { Link } from 'shared'

import DateRangeCalendar from '@/components/DateRangeCalendar'
import PaperSplitSidebar from '@/components/PaperSplitSidebar'
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
  const normalizeAbstract = (value: string) => value.replace(/[\r\n]+/g, '')

  useEffect(() => {
    setAbstract(normalizeAbstract(item.abstract))
  }, [item.abstract, item.id])

  const isDirty = abstract !== item.abstract

  return (
    <Card className="group overflow-hidden border border-bg-500/10 bg-component-bg/90 p-0 shadow-sm">
      <div className="flex gap-4">
        <div className="w-1 shrink-0 rounded-l-[11px] bg-custom-500" />
        <div className="flex min-w-0 flex-1 items-start gap-4 py-4 pr-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-custom-500/20 bg-custom-500/10">
            <Icon className="text-custom-500 size-5" icon="tabler:file-text" />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1.5">
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
                {item.source && <TagChip icon="tabler:rss" label={item.source} variant="outlined" />}
                {item.fetchedAt && (
                  <span className="text-bg-500 text-xs whitespace-nowrap">
                    {new Date(item.fetchedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Abstract</p>
                  <span className="text-bg-400 text-xs font-normal">({abstract.length}/6000)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isDirty && (
                    <Button icon="tabler:device-floppy" onClick={() => onSave({ id: item.id, abstract })}>
                      <span>Save</span>
                    </Button>
                  )}
                  <Button
                    icon="tabler:eraser"
                    variant="secondary"
                    onClick={() => onSave({ id: item.id, abstract: '' })}
                  >
                    <span>Clear</span>
                  </Button>
                </div>
              </div>
              <TextAreaInput
                className="min-h-40"
                icon="tabler:file-text"
                label="Abstract"
                placeholder="Review or edit the extracted abstract here"
                value={abstract}
                onChange={value => setAbstract(normalizeAbstract(value))}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function AbstractReviewPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().slice(0, 10))
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10))
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
            <span>Back</span>
          </Button>
        }
        icon="tabler:file-search"
        namespace={MODULE_NAMESPACE}
        title="abstractReviewPage"
        totalItems={data?.totalItems}
      />

      <div className="flex size-full min-h-0 flex-1" style={{ gap: '2rem' }}>
        <PaperSplitSidebar>
          <div className="space-y-3 rounded-2xl border border-bg-500/10 bg-component-bg-lighter/50 p-4">
            <div className="flex items-center gap-2">
              <Icon className="text-custom-500 size-4" icon="tabler:calendar-month" />
              <h3 className="text-sm font-semibold">Date Filter</h3>
            </div>
            <DateRangeCalendar
              dateFrom={dateFrom}
              dateTo={dateTo}
              defaultLabel="default: today"
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
            />
          </div>

          <div className="space-y-2 rounded-2xl border border-bg-500/10 bg-component-bg-lighter/50 p-4">
            <SidebarTitle label="Sources" namespace={MODULE_NAMESPACE} />
            <SidebarItem
              active={!selectedSource}
              icon="tabler:list"
              label="All sources"
              namespace={false}
              number={data?.totalItems}
              onClick={() => setSelectedSource('')}
            />
            <div className="space-y-1">
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
            </div>
            {hasFilters && (
              <Button className="mt-2" icon="tabler:refresh" variant="secondary" onClick={resetFilters}>
                <span>Reset</span>
              </Button>
            )}
          </div>
        </PaperSplitSidebar>

        <div className="relative z-10 flex h-full min-w-0 flex-1 flex-col">
          <Card className="space-y-4 border border-bg-500/10 bg-component-bg/80 p-5 shadow-sm">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold">All Papers{data?.totalItems != null ? ` (${data.totalItems})` : ''}</h2>
                {selectedSource && <TagChip icon="tabler:rss" label={selectedSource} variant="filled" />}
              </div>
              <p className="text-bg-500 text-sm">Review extracted abstracts and patch missing metadata in place.</p>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-bg-500/10 pt-4">
              {dateFrom && <TagChip icon="tabler:calendar-event" label={`From ${dateFrom}`} variant="outlined" />}
              {dateTo && <TagChip icon="tabler:calendar-check" label={`To ${dateTo}`} variant="outlined" />}
            </div>
          </Card>

          <div className="mt-8 flex min-h-0 flex-1 flex-col">
            <Scrollbar>
              <WithQuery query={reviewQuery}>
            {response =>
              (response as AbstractReviewListResponse).items.length === 0 ? (
                <EmptyStateScreen
                  icon="tabler:file-search"
                  message={{
                    id: 'abstractReview',
                    namespace: MODULE_NAMESPACE
                  }}
                />
              ) : (
                <div className="space-y-4 px-1 pb-8">
                  {(response as AbstractReviewListResponse).items.map(item => (
                    <ReviewCard
                      key={item.id}
                      item={item}
                      onSave={async input => {
                        await updateMutation.mutateAsync(input)
                      }}
                    />
                  ))}

                  {(response as AbstractReviewListResponse).totalPages > 1 && (
                    <Pagination
                      page={(response as AbstractReviewListResponse).page}
                      totalPages={(response as AbstractReviewListResponse).totalPages}
                      onPageChange={value => {
                        setPage(typeof value === 'function' ? value(page) : value)
                      }}
                    />
                  )}
                </div>
              )
            }
              </WithQuery>
            </Scrollbar>
          </div>
        </div>
      </div>
    </>
  )
}

export default AbstractReviewPage
