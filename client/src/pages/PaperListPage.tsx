import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Button,
  Card,
  DateInput,
  EmptyStateScreen,
  ModuleHeader,
  Pagination,
  SearchInput,
  Switch,
  TagChip,
  WithQuery
} from 'lifeforge-ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { Link, useSearchParams } from 'shared'

import PaperCard from '@/components/PaperCard'
import PaperDetailModal from '@/components/PaperDetailModal'
import forgeAPI from '@/utils/forgeAPI'
import {
  MODULE_BASE_PATH,
  MODULE_NAMESPACE,
  MODULE_ROUTE_KEY
} from '@/utils/module'
import { toggleStringInList } from '@/utils/papers'
import type { PaperListResponse } from '@/utils/types'

const DEFAULT_FETCH_DATE = dayjs().format('YYYY-MM-DD')
const DEFAULT_SORT = 'score_desc' as const

function PaperListPage() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState(DEFAULT_FETCH_DATE)
  const [dateTo, setDateTo] = useState(DEFAULT_FETCH_DATE)
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [selectedJournals, setSelectedJournals] = useState<string[]>([])
  const [selectedCollections, setSelectedCollections] = useState<string[]>([])
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [hasAbstractOnly, setHasAbstractOnly] = useState(true)

  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const activePaperId = searchParams.get('paper') ?? ''
  const pendingPageTransitionRef = useRef<'next' | 'previous' | null>(null)

  useEffect(() => {
    setPage(1)
  }, [
    query,
    dateFrom,
    dateTo,
    selectedSources.join(','),
    selectedJournals.join(','),
    selectedCollections.join(','),
    favoritesOnly,
    hasAbstractOnly
  ])

  const listQueryInput = {
    page,
    perPage: 24,
    query: query || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sources: selectedSources.join(',') || undefined,
    journals: selectedJournals.join(',') || undefined,
    collections: selectedCollections.join(',') || undefined,
    favoritesOnly: String(favoritesOnly) as 'true' | 'false',
    hasAbstractOnly: String(hasAbstractOnly) as 'true' | 'false',
    sort: DEFAULT_SORT
  }

  const papersQuery = useQuery(
    forgeAPI.papers.list.input(listQueryInput).queryOptions({
      queryKey: [MODULE_ROUTE_KEY, 'papers', 'list', listQueryInput]
    })
  )

  const filtersMetaQuery = useQuery(
    forgeAPI.papers.filters.meta.queryOptions({
      queryKey: [MODULE_ROUTE_KEY, 'papers', 'filters']
    })
  )

  const toggleFavoriteMutation = useMutation(
    forgeAPI.papers.favorites.toggle.mutationOptions({
      onSuccess: data => {
        toast.success(data.isFavorite ? 'Added to favorites' : 'Removed from favorites')
        queryClient.invalidateQueries({
          queryKey: [MODULE_ROUTE_KEY]
        })
      },
      onError: error => {
        toast.error(error instanceof Error ? error.message : 'Failed to update favorite')
      }
    })
  )

  const totalItems = (papersQuery.data as PaperListResponse | undefined)?.totalItems
  const totalPages = (papersQuery.data as PaperListResponse | undefined)?.totalPages ?? 1
  const visiblePaperIds = useMemo(
    () => ((papersQuery.data as PaperListResponse | undefined)?.items ?? []).map(item => item.id),
    [papersQuery.data]
  )
  const activePaperIndex = visiblePaperIds.indexOf(activePaperId)
  const currentPosition =
    activePaperIndex >= 0
      ? (page - 1) * listQueryInput.perPage + activePaperIndex + 1
      : undefined
  const activeFilterCount = [
    query.trim(),
    dateFrom,
    dateTo,
    selectedSources.length,
    selectedJournals.length,
    selectedCollections.length,
    favoritesOnly ? 1 : 0,
    hasAbstractOnly ? 1 : 0
  ].filter(Boolean).length

  const resetFilters = () => {
    setQuery('')
    setDateFrom(DEFAULT_FETCH_DATE)
    setDateTo(DEFAULT_FETCH_DATE)
    setSelectedSources([])
    setSelectedJournals([])
    setSelectedCollections([])
    setFavoritesOnly(false)
    setHasAbstractOnly(true)
  }

  const openPaperDetail = (paperId: string) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('paper', paperId)
    setSearchParams(nextParams)
  }

  const closePaperDetail = () => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('paper')
    setSearchParams(nextParams)
  }

  const openNextPaper = () => {
    if (activePaperIndex >= 0 && activePaperIndex < visiblePaperIds.length - 1) {
      openPaperDetail(visiblePaperIds[activePaperIndex + 1]!)
      return
    }

    if (page < totalPages) {
      pendingPageTransitionRef.current = 'next'
      setPage(currentPage => currentPage + 1)
    }
  }

  const openPreviousPaper = () => {
    if (activePaperIndex > 0) {
      openPaperDetail(visiblePaperIds[activePaperIndex - 1]!)
      return
    }

    if (page > 1) {
      pendingPageTransitionRef.current = 'previous'
      setPage(currentPage => Math.max(1, currentPage - 1))
    }
  }

  useEffect(() => {
    if (!activePaperId) {
      pendingPageTransitionRef.current = null
      return
    }

    if (!pendingPageTransitionRef.current || visiblePaperIds.length === 0) {
      return
    }

    const direction = pendingPageTransitionRef.current
    pendingPageTransitionRef.current = null
    openPaperDetail(direction === 'next' ? visiblePaperIds[0]! : visiblePaperIds[visiblePaperIds.length - 1]!)
  }, [activePaperId, page, visiblePaperIds])

  return (
    <>
      <div
        className={`transition-all duration-300 ${
          activePaperId ? 'pointer-events-none select-none blur-[4px] saturate-75' : ''
        }`}
      >
        <ModuleHeader
          actionButton={
            <div className="flex items-center gap-2">
              <Button as={Link} icon="tabler:star" to={`${MODULE_BASE_PATH}/favorites`}>
                Favorites
              </Button>
              <Button
                as={Link}
                icon="tabler:file-import"
                to={`${MODULE_BASE_PATH}/import`}
                variant="secondary"
              >
                Import
              </Button>
              <Button
                as={Link}
                icon="tabler:player-play"
                to={`${MODULE_BASE_PATH}/run`}
                variant="secondary"
              >
                Run
              </Button>
              <Button
                as={Link}
                icon="tabler:settings"
                to={`${MODULE_BASE_PATH}/settings`}
                variant="secondary"
              >
                Settings
              </Button>
            </div>
          }
          icon="tabler:books"
          namespace={MODULE_NAMESPACE}
          title="papersPage"
          totalItems={totalItems}
        />

        <div className="mb-6 space-y-4">
          <Card className="from-component-bg-lighter to-component-bg space-y-5 bg-gradient-to-br">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.9fr)]">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <TagChip
                    icon="tabler:database"
                    label={`${totalItems ?? 0} matching papers`}
                    variant="filled"
                  />
                  <TagChip
                    icon="tabler:filter"
                    label={`${activeFilterCount} active filters`}
                    variant="outlined"
                  />
                  <TagChip
                    icon="tabler:chart-bar"
                    label="Top score"
                    variant="outlined"
                  />
                </div>
                <h2 className="text-2xl font-semibold">Explore the current paper pool</h2>
                <p className="text-bg-500 max-w-3xl text-sm leading-6">
                  By default, the homepage shows papers fetched today and ranks them by your
                  current score. The filters below still let you widen the fetch window or
                  narrow it by source, journal, and collections.
                </p>
              </div>

              <SearchInput
                debounceMs={250}
                namespace={MODULE_NAMESPACE}
                searchTarget="paper"
                value={query}
                onChange={setQuery}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <Card className="component-bg-lighter space-y-1 p-4">
                <p className="text-sm font-medium">Today by default</p>
                <p className="text-bg-500 text-sm">
                  The first view focuses on papers fetched today, and the date filter keeps using
                  fetch time rather than publication time.
                </p>
              </Card>
              <Card className="component-bg-lighter space-y-1 p-4">
                <p className="text-sm font-medium">Score-ranked view</p>
                <p className="text-bg-500 text-sm">
                  The paper feed is ordered by your current recommend score so the most relevant
                  items rise to the top first.
                </p>
              </Card>
              <Card className="component-bg-lighter flex items-center justify-between gap-3 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Need a clean slate?</p>
                  <p className="text-bg-500 text-sm">
                    Reset the current search and filter stack in one step.
                  </p>
                </div>
                <Button
                  icon="tabler:filter-x"
                  variant="secondary"
                  onClick={resetFilters}
                >
                  Reset
                </Button>
              </Card>
            </div>
          </div>
          </Card>

          <Card className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <Card className="component-bg-lighter space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Quick filters</h2>
                <p className="text-bg-500 text-sm">
                  Narrow the list by fetched time, saved state, and summary availability.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-bg-500 block text-sm font-medium">
                    From
                  </label>
                  <DateInput
                    value={dateFrom ? dayjs(dateFrom).toDate() : null}
                    variant="plain"
                    onChange={value => {
                      setDateFrom(value ? dayjs(value).format('YYYY-MM-DD') : '')
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-bg-500 block text-sm font-medium">
                    To
                  </label>
                  <DateInput
                    value={dateTo ? dayjs(dateTo).toDate() : null}
                    variant="plain"
                    onChange={value => {
                      setDateTo(value ? dayjs(value).format('YYYY-MM-DD') : '')
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Only favorites</p>
                  <p className="text-bg-500 text-sm">Show only items already pinned into your folders.</p>
                </div>
                <Switch value={favoritesOnly} onChange={setFavoritesOnly} />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Only with summaries</p>
                  <p className="text-bg-500 text-sm">
                    Keep the list focused on papers that already have an abstract or TL;DR.
                  </p>
                </div>
                <Switch value={hasAbstractOnly} onChange={setHasAbstractOnly} />
              </div>
            </Card>

            <Card className="component-bg-lighter space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Metadata filters</h2>
                <p className="text-bg-500 text-sm">
                  Filter by source, journal, or matched Zotero collections.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Sources</h3>
                  <div className="flex flex-wrap gap-2">
                    {(filtersMetaQuery.data?.sources ?? []).map(source => (
                      <TagChip
                        key={source}
                        icon="tabler:rss"
                        label={source}
                        variant={
                          selectedSources.includes(source) ? 'filled' : 'outlined'
                        }
                        onClick={() => {
                          setSelectedSources(current =>
                            toggleStringInList(current, source)
                          )
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Journals</h3>
                  <div className="flex flex-wrap gap-2">
                    {(filtersMetaQuery.data?.journals ?? []).map(journal => (
                      <TagChip
                        key={journal}
                        icon="tabler:book"
                        label={journal}
                        variant={
                          selectedJournals.includes(journal) ? 'filled' : 'outlined'
                        }
                        onClick={() => {
                          setSelectedJournals(current =>
                            toggleStringInList(current, journal)
                          )
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Collections</h3>
                  <div className="flex flex-wrap gap-2">
                    {(filtersMetaQuery.data?.collections ?? []).map(collection => (
                      <TagChip
                        key={collection}
                        icon="tabler:folders"
                        label={collection}
                        variant={
                          selectedCollections.includes(collection)
                            ? 'filled'
                            : 'outlined'
                        }
                        onClick={() => {
                          setSelectedCollections(current =>
                            toggleStringInList(current, collection)
                          )
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Card>
            </div>
          </Card>
        </div>

        <WithQuery query={papersQuery}>
          {data =>
            data.items.length === 0 ? (
              <EmptyStateScreen
                icon="tabler:book-off"
                message={{
                  id: 'papers',
                  namespace: MODULE_NAMESPACE
                }}
              />
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      Showing {data.items.length} of {data.totalItems} matching papers
                    </p>
                    <p className="text-bg-500 text-sm">
                      Results are ordered by score, while cards still surface your favorites,
                      matched collections, and AI overlays.
                    </p>
                  </div>
                  {data.totalPages > 1 && (
                    <TagChip
                      icon="tabler:bookmark"
                      label={`Page ${data.page} of ${data.totalPages}`}
                      variant="outlined"
                    />
                  )}
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {data.items.map(paper => (
                    <PaperCard
                      key={paper.id}
                      favoriteLoading={
                        toggleFavoriteMutation.isPending &&
                        toggleFavoriteMutation.variables?.paperId === paper.id
                      }
                      paper={paper}
                      onOpenDetail={() => {
                        openPaperDetail(paper.id)
                      }}
                      onToggleFavorite={() => {
                        toggleFavoriteMutation.mutate({
                          paperId: paper.id,
                          folderId: paper.favoriteFolderId
                        })
                      }}
                    />
                  ))}
                </div>

                {data.totalPages > 1 && (
                  <Pagination
                    page={data.page}
                    totalPages={data.totalPages}
                    onPageChange={value => {
                      setPage(typeof value === 'function' ? value(page) : value)
                    }}
                  />
                )}
              </div>
            )
          }
        </WithQuery>
      </div>

      {activePaperId && (
        <PaperDetailModal
          activePaperId={activePaperId}
          currentPosition={currentPosition}
          totalItems={totalItems}
          hasPrev={page > 1 || activePaperIndex > 0}
          hasNext={page < totalPages || activePaperIndex < visiblePaperIds.length - 1}
          onNext={openNextPaper}
          onPrevious={openPreviousPaper}
          onClose={closePaperDetail}
        />
      )}
    </>
  )
}

export default PaperListPage
