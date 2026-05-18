import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Button,
  DateInput,
  EmptyStateScreen,
  ModuleHeader,
  Pagination,
  SearchInput,
  Switch,
  TagChip,
  WithQuery,
  useModalStore
} from 'lifeforge-ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { Link, useSearchParams } from 'shared'

import PaperCard from '@/components/PaperCard'
import PaperDetailModal from '@/components/PaperDetailModal'
import SaveFavoriteModal from '@/components/SaveFavoriteModal'
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
  const { open } = useModalStore()
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
            <Button as={Link} icon="tabler:player-play" to={`${MODULE_BASE_PATH}/settings`}>
              Pipeline
            </Button>
          }
          icon="tabler:books"
          title="Papers"
          totalItems={totalItems}
        />

        <div className="flex min-h-0 w-full flex-1 gap-6">
          {/* Filter Sidebar */}
          <aside className="w-56 shrink-0 space-y-5">
            {/* Date Filter */}
            <div className="space-y-2">
              <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">
                Date Filter
                <span className="ml-1 font-normal tracking-normal">(fetched)</span>
              </p>
              <div className="space-y-2">
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
              </div>
            </div>

            {/* Sources */}
            <div className="space-y-2">
              <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Sources</p>
              <div className="flex flex-wrap gap-1.5">
                {(filtersMetaQuery.data?.sources ?? []).map(source => (
                  <TagChip
                    key={source}
                    icon="tabler:rss"
                    label={source}
                    variant={selectedSources.includes(source) ? 'filled' : 'outlined'}
                    onClick={() => {
                      setSelectedSources(current => toggleStringInList(current, source))
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Journals */}
            <div className="space-y-2">
              <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Journals</p>
              <div className="flex flex-wrap gap-1.5">
                {(filtersMetaQuery.data?.journals ?? []).map(journal => (
                  <TagChip
                    key={journal}
                    icon="tabler:book"
                    label={journal}
                    variant={selectedJournals.includes(journal) ? 'filled' : 'outlined'}
                    onClick={() => {
                      setSelectedJournals(current => toggleStringInList(current, journal))
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Collections */}
            <div className="space-y-2">
              <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Collections</p>
              <div className="flex flex-wrap gap-1.5">
                {(filtersMetaQuery.data?.collections ?? []).map(collection => (
                  <TagChip
                    key={collection}
                    icon="tabler:folders"
                    label={collection}
                    variant={selectedCollections.includes(collection) ? 'filled' : 'outlined'}
                    onClick={() => {
                      setSelectedCollections(current => toggleStringInList(current, collection))
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Quick toggles */}
            <div className="space-y-2.5">
              <div className="border-bg-500/10 bg-component-bg-lighter flex items-center justify-between rounded-xl border px-3 py-2.5">
                <p className="text-xs font-medium">Favorites only</p>
                <Switch value={favoritesOnly} onChange={setFavoritesOnly} />
              </div>
              <div className="border-bg-500/10 bg-component-bg-lighter flex items-center justify-between rounded-xl border px-3 py-2.5">
                <p className="text-xs font-medium">With abstract</p>
                <Switch value={hasAbstractOnly} onChange={setHasAbstractOnly} />
              </div>
            </div>

            {activeFilterCount > 0 && (
              <Button icon="tabler:refresh" variant="secondary" onClick={resetFilters}>
                Reset filters
              </Button>
            )}
          </aside>

          {/* Main Content */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">
                  All Papers{totalItems != null ? ` (${totalItems})` : ''}
                </h2>
                <Button
                  as={Link}
                  icon="tabler:star"
                  to={`${MODULE_BASE_PATH}/favorites`}
                  variant="secondary"
                >
                  Favorites
                </Button>
              </div>
            </div>

            <div className="mb-4">
              <SearchInput
                debounceMs={250}
                namespace={MODULE_NAMESPACE}
                searchTarget="paper"
                value={query}
                onChange={setQuery}
              />
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
                    <div className="grid gap-4 xl:grid-cols-2">
                      {data.items.map(paper => (
                        <PaperCard
                          key={paper.id}
                          favoriteLoading={
                            paper.isFavorite &&
                            toggleFavoriteMutation.isPending &&
                            toggleFavoriteMutation.variables?.paperId === paper.id
                          }
                          paper={paper}
                          onOpenDetail={() => {
                            openPaperDetail(paper.id)
                          }}
                          onToggleFavorite={() => {
                            if (paper.isFavorite) {
                              toggleFavoriteMutation.mutate({
                                paperId: paper.id,
                                folderId: paper.favoriteFolderId ?? undefined
                              })
                              return
                            }

                            open(SaveFavoriteModal, {
                              paperId: paper.id,
                              paperTitle: paper.translatedTitle || paper.title
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
        </div>
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
