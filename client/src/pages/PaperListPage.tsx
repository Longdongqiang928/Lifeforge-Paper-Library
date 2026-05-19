import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Icon } from '@iconify/react'
import dayjs from 'dayjs'
import {
  Button,
  Card,
  EmptyStateScreen,
  ModuleHeader,
  Pagination,
  SearchInput,
  SidebarWrapper,
  Switch,
  TagChip,
  WithQuery,
  useModalStore
} from 'lifeforge-ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'react-toastify'
import { Link, useSearchParams } from 'shared'

import DateRangeCalendar from '@/components/DateRangeCalendar'
import FilterPillGrid from '@/components/FilterPillGrid'
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

function FilterSection({
  title,
  icon,
  children
}: {
  title: string
  icon: string
  children: ReactNode
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-bg-500/10 bg-component-bg-lighter/50 p-4">
      <div className="flex items-center gap-2">
        <Icon className="text-custom-500 size-4" icon={icon} />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function PaperListPage() {
  const { open } = useModalStore()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState(DEFAULT_FETCH_DATE)
  const [dateTo, setDateTo] = useState(DEFAULT_FETCH_DATE)
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

  const hasAnyFilter =
    selectedJournals.length > 0 ||
    selectedCollections.length > 0 ||
    favoritesOnly ||
    !hasAbstractOnly ||
    query.length > 0 ||
    dateFrom !== DEFAULT_FETCH_DATE ||
    dateTo !== DEFAULT_FETCH_DATE

  const resetFilters = () => {
    setQuery('')
    setDateFrom(DEFAULT_FETCH_DATE)
    setDateTo(DEFAULT_FETCH_DATE)
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

  const journals = filtersMetaQuery.data?.journals ?? []
  const collections = filtersMetaQuery.data?.collections ?? []

  return (
    <>
      <div
        className={`transition-all duration-300 ${
          activePaperId ? 'pointer-events-none select-none blur-[4px] saturate-75' : ''
        }`}
      >
        <ModuleHeader
          actionButton={
            <div className="flex flex-nowrap items-center gap-2">
              <Button as={Link} icon="tabler:file-search" to={`${MODULE_BASE_PATH}/abstract-review`} variant="secondary">
                <span>Review</span>
              </Button>
              <Button as={Link} icon="tabler:file-import" to={`${MODULE_BASE_PATH}/import`} variant="secondary">
                <span>Import</span>
              </Button>
              <Button as={Link} icon="tabler:settings" to={`${MODULE_BASE_PATH}/settings`}>
                <span>Settings</span>
              </Button>
            </div>
          }
          icon="tabler:books"
          title="Paper Library"
          totalItems={totalItems}
        />

        <div className="flex size-full min-h-0 flex-1 gap-6 xl:gap-7">
          <div className="h-full w-[272px] shrink-0 overflow-y-auto pr-1"><SidebarWrapper>
            <FilterSection icon="tabler:calendar-month" title="Date Filter">
              <DateRangeCalendar
                dateFrom={dateFrom}
                dateTo={dateTo}
                defaultLabel="default: today"
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
              />
            </FilterSection>

            <FilterSection icon="tabler:adjustments-horizontal" title="Filters">
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-component-bg px-3 py-2.5">
                  <span className="text-sm font-medium">With abstract</span>
                  <Switch value={hasAbstractOnly} onChange={setHasAbstractOnly} />
                </div>
                <div className="flex items-center justify-between rounded-xl bg-component-bg px-3 py-2.5">
                  <span className="text-sm font-medium">Favorites only</span>
                  <Switch value={favoritesOnly} onChange={setFavoritesOnly} />
                </div>
                {hasAnyFilter && (
                  <Button icon="tabler:refresh" variant="secondary" onClick={resetFilters}>
                    <span>Reset</span>
                  </Button>
                )}
              </div>
            </FilterSection>

            <div className="space-y-4">
              <div className="space-y-2 rounded-2xl border border-bg-500/10 bg-component-bg-lighter/50 p-4">
                <div className="flex items-center gap-2">
                  <Icon className="text-custom-500 size-4" icon="tabler:book" />
                  <h3 className="text-sm font-semibold">Journals</h3>
                </div>
                <FilterPillGrid
                  icon="tabler:book"
                  items={journals}
                  selected={selectedJournals}
                  onToggle={journal => setSelectedJournals(prev => toggleStringInList(prev, journal))}
                />
              </div>

              <div className="space-y-2 rounded-2xl border border-bg-500/10 bg-component-bg-lighter/50 p-4">
                <div className="flex items-center gap-2">
                  <Icon className="text-custom-500 size-4" icon="tabler:folders" />
                  <h3 className="text-sm font-semibold">Collections</h3>
                </div>
                <FilterPillGrid
                  icon="tabler:folders"
                  items={collections}
                  selected={selectedCollections}
                  onToggle={collection => setSelectedCollections(prev => toggleStringInList(prev, collection))}
                />
              </div>
            </div>
          </SidebarWrapper></div>

          <div className="relative z-10 flex h-full min-w-0 flex-1 flex-col gap-5">
            <Card className="space-y-4 border border-bg-500/10 bg-component-bg/80 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-semibold">All Papers{totalItems != null ? ` (${totalItems})` : ''}</h2>
                    <TagChip icon="tabler:calendar" label="Today" variant="outlined" />
                    <TagChip icon="tabler:chart-dots-3" label="Score sorted" variant="outlined" />
                  </div>
                </div>
                <Button
                  as={Link}
                  icon="tabler:star"
                  to={`${MODULE_BASE_PATH}/favorites`}
                  variant="secondary"
                >
                  <span>Favorites</span>
                </Button>
              </div>

              <SearchInput
                debounceMs={250}
                namespace={MODULE_NAMESPACE}
                searchTarget="paper"
                value={query}
                onChange={setQuery}
              />

              {(selectedJournals.length > 0 || selectedCollections.length > 0) && (
                <div className="flex flex-wrap gap-2 border-t border-bg-500/10 pt-4">
                  {selectedJournals.map(journal => (
                    <TagChip
                      key={`journal-${journal}`}
                      icon="tabler:book"
                      label={journal}
                      variant="filled"
                      onClick={() => setSelectedJournals(prev => prev.filter(item => item !== journal))}
                    />
                  ))}
                  {selectedCollections.map(collection => (
                    <TagChip
                      key={`collection-${collection}`}
                      icon="tabler:folders"
                      label={collection}
                      variant="filled"
                      onClick={() => setSelectedCollections(prev => prev.filter(item => item !== collection))}
                    />
                  ))}
                </div>
              )}
            </Card>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
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
                  <div className="space-y-6 px-1 pb-8">
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
