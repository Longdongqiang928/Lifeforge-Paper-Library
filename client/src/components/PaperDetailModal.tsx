import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, ModalHeader, ModalWrapper, TagChip, WithQuery } from 'lifeforge-ui'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'

import forgeAPI from '@/utils/forgeAPI'
import { MODULE_ROUTE_KEY } from '@/utils/module'

import PaperDetailContent from './PaperDetailContent'

type NavigationDirection = 'next' | 'previous'
type MotionState =
  | 'idle'
  | 'leaving-next'
  | 'leaving-previous'
  | 'entering-next'
  | 'entering-previous'

interface PaperDetailModalProps {
  activePaperId: string
  currentPosition?: number
  totalItems?: number
  hasPrev: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onClose: () => void
}

function getMotionClass(motionState: MotionState) {
  switch (motionState) {
    case 'leaving-next':
      return 'translate-x-8 opacity-0'
    case 'leaving-previous':
      return '-translate-x-8 opacity-0'
    case 'entering-next':
      return '-translate-x-8 opacity-0'
    case 'entering-previous':
      return 'translate-x-8 opacity-0'
    default:
      return 'translate-x-0 opacity-100'
  }
}

function PaperDetailModal({
  activePaperId,
  currentPosition,
  totalItems,
  hasPrev,
  hasNext,
  onPrevious,
  onNext,
  onClose
}: PaperDetailModalProps) {
  const queryClient = useQueryClient()
  const [displayPaperId, setDisplayPaperId] = useState(activePaperId)
  const [motionState, setMotionState] = useState<MotionState>('idle')
  const pendingDirectionRef = useRef<NavigationDirection>('next')

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    if (!activePaperId || activePaperId === displayPaperId) {
      return
    }

    void queryClient.prefetchQuery(
      forgeAPI.papers.detail
        .input({
          id: activePaperId
        })
        .queryOptions({
          queryKey: [MODULE_ROUTE_KEY, 'papers', 'detail', activePaperId]
        })
    )

    const direction = pendingDirectionRef.current
    setMotionState(direction === 'next' ? 'leaving-next' : 'leaving-previous')

    const swapTimer = window.setTimeout(() => {
      setDisplayPaperId(activePaperId)
      setMotionState(direction === 'next' ? 'entering-next' : 'entering-previous')

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setMotionState('idle')
        })
      })
    }, 150)

    return () => {
      window.clearTimeout(swapTimer)
    }
  }, [activePaperId, displayPaperId, queryClient])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key === 'ArrowLeft' && hasPrev) {
        pendingDirectionRef.current = 'previous'
        onPrevious()
      }

      if (event.key === 'ArrowRight' && hasNext) {
        pendingDirectionRef.current = 'next'
        onNext()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [hasNext, hasPrev, onClose, onNext, onPrevious])

  const paperQuery = useQuery(
    forgeAPI.papers.detail
      .input({
        id: displayPaperId
      })
      .queryOptions({
        enabled: !!displayPaperId,
        queryKey: [MODULE_ROUTE_KEY, 'papers', 'detail', displayPaperId]
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

  return (
    <ModalWrapper
      isOpen={true}
      className="border-bg-500/15 bg-component-bg/95 overflow-hidden border shadow-2xl backdrop-blur-md"
      maxWidth="64rem"
      zIndex={10020}
    >
      <div className="relative flex w-full items-center justify-center">
        <div className="pointer-events-none absolute top-1/2 left-0 z-50 hidden -translate-x-[60%] -translate-y-1/2 items-center lg:flex">
          <Button
            className="pointer-events-auto shadow-xl"
            disabled={!hasPrev}
            icon="tabler:chevron-left"
            variant="secondary"
            onClick={() => {
              if (!hasPrev) return
              pendingDirectionRef.current = 'previous'
              onPrevious()
            }}
          />
        </div>

        <div className="pointer-events-none absolute top-1/2 right-0 z-50 hidden translate-x-[60%] -translate-y-1/2 items-center lg:flex">
          <Button
            className="pointer-events-auto shadow-xl"
            disabled={!hasNext}
            icon="tabler:chevron-right"
            variant="secondary"
            onClick={() => {
              if (!hasNext) return
              pendingDirectionRef.current = 'next'
              onNext()
            }}
          />
        </div>

        <div
          className="relative z-10 flex h-[calc(100vh-12rem)] w-full flex-col overflow-hidden"
          style={{
            maxHeight: '58rem'
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            <div
              className={`transition-all duration-300 ease-out ${getMotionClass(motionState)}`}
            >
              <WithQuery query={paperQuery}>
                {paper => (
                  <div className="space-y-4">
                    <div className="space-y-4">
                      <ModalHeader
                        icon="tabler:file-description"
                        title={<span>Paper details</span>}
                        onClose={onClose}
                      />

                      <Card className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <TagChip
                            icon="tabler:layout-sidebar-right-collapse"
                            label="Reading panel"
                            variant="filled"
                          />
                          {typeof currentPosition === 'number' && typeof totalItems === 'number' && (
                            <TagChip
                              icon="tabler:list-numbers"
                              label={`${currentPosition} / ${totalItems}`}
                              variant="outlined"
                            />
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 lg:hidden">
                          <Button
                            disabled={!hasPrev}
                            icon="tabler:chevron-left"
                            variant="secondary"
                            onClick={() => {
                              if (!hasPrev) return
                              pendingDirectionRef.current = 'previous'
                              onPrevious()
                            }}
                          >
                            Previous
                          </Button>
                          <Button
                            disabled={!hasNext}
                            icon="tabler:chevron-right"
                            iconPosition="end"
                            variant="secondary"
                            onClick={() => {
                              if (!hasNext) return
                              pendingDirectionRef.current = 'next'
                              onNext()
                            }}
                          >
                            Next
                          </Button>
                        </div>
                      </Card>
                    </div>

                    <PaperDetailContent
                      compact
                      favoriteLoading={toggleFavoriteMutation.isPending}
                      paper={paper}
                      onToggleFavorite={() => {
                        toggleFavoriteMutation.mutate({
                          paperId: paper.id,
                          folderId: paper.favoriteFolderId
                        })
                      }}
                    />
                  </div>
                )}
              </WithQuery>
            </div>
          </div>
        </div>
      </div>
    </ModalWrapper>
  )
}

export default PaperDetailModal
