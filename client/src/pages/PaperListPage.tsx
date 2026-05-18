import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Button,
  DateInput,
  EmptyStateScreen,
  ModuleHeader,
  Pagination,
  SearchInput,
  SidebarDivider,
  SidebarItem,
  SidebarTitle,
  SidebarWrapper,
  Switch,
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

  const hasAnyFilter = selectedSources.length > 0 || selectedJournals.length > 0 || selectedCollections.length > 0

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

  const sources = filtersMetaQuery.data?.sources ?? []
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
            <Button as={Link} icon="tabler:player-play" to={`${MODULE_BASE_PATH}/settings`}>
              Pipeline
            </Button>
          }
          icon="tabler:books"
          title="Papers"
          totalItems={totalItems}
        />

        <div className="flex size-full min-h-0 flex-1">
          <SidebarWrapper>
            <SidebarItem
              active={!hasAnyFilter}
              icon="tabler:list"
              label="All Papers"
              namespace={MODULE_NAMESPACE}
              number={totalItems}
              onClick={resetFilters}
            />
            <SidebarItem
              active={favoritesOnly}
              icon="tabler:star-filled"
              label="Favorites only"
              namespace={MODULE_NAMESPACE}
              onClick={() => setFavoritesOnly(!favoritesOnly)}
            />
            <SidebarDivider />
            <SidebarTitle label="Sources" namespace={MODULE_NAMESPACE} />
            {sources.map(source => (
              <SidebarItem
                key={source}
                active={selectedSources.includes(source)}
                icon="tabler:rss"
                label={source}
                onCancelButtonClick={() =>
                  setSelectedSources(prev => prev.filter(s => s !== source))
                }
                onClick={() =>
                  setSelectedSources(prev => toggleStringInList(prev, source))
                }
              />
            ))}
            <SidebarDivider />
            <SidebarTitle label="Journals" namespace={MODULE_NAMESPACE} />
            {journals.map(journal => (
              <SidebarItem
                key={journal}
                active={selectedJournals.includes(journal)}
                icon="tabler:book"
                label={journal}
                onCancelButtonClick={() =>
                  setSelectedJournals(prev => prev.filter(j => j !== journal))
                }
                onClick={() =>
                  setSelectedJournals(prev => toggleStringInList(prev, journal))
                }
              />
            ))}
            <SidebarDivider />
            <SidebarTitle label="Collections" namespace={MODULE_NAMESPACE} />
            {collections.map(collection => (
              <SidebarItem
                key={collection}
                active={selectedCollections.includes(collection)}
                icon="tabler:folders"
                label={collection}
                onCancelButtonClick={() =>
                  setSelectedCollections(prev => prev.filter(c => c !== collection))
                }
                onClick={() =>
                  setSelectedCollections(prev => toggleStringInList(prev, collection))
                }
              />
            ))}
          </SidebarWrapper>

          <div className="relative z-10 flex h-full flex-1 flex-col xl:ml-8">
            {/* Controls bar */}
            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  Papers{totalItems != null ? ` (${totalItems})` : ''}
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

              <SearchInput
                debounceMs={250}
                namespace={MODULE_NAMESPACE}
                searchTarget="paper"
                value={query}
                onChange={setQuery}
              />

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
                <div className="border-bg-500/10 bg-component-bg-lighter flex items-center gap-3 rounded-xl border px-3 py-2">
                  <span className="text-xs font-medium">With abstract</span>
                  <Switch value={hasAbstractOnly} onChange={setHasAbstractOnly} />
                </div>
                {hasAnyFilter && (
                  <Button icon="tabler:refresh" variant="secondary" onClick={resetFilters}>
                    Reset
                  </Button>
                )}
              </div>
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
