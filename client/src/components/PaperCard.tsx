import { Icon } from '@iconify/react'
import { Button, Card, TagChip } from 'lifeforge-ui'
import { Link } from 'shared'

import { formatAuthors, formatPaperDate } from '@/utils/papers'
import type { PaperListItem } from '@/utils/types'

interface PaperCardProps {
  paper: PaperListItem
  detailTo?: string
  onToggleFavorite: () => void | Promise<void>
  favoriteLoading?: boolean
  secondaryAction?: React.ReactNode
  onOpenDetail?: () => void
}

function PaperCard({
  paper,
  detailTo,
  onToggleFavorite,
  favoriteLoading = false,
  secondaryAction,
  onOpenDetail
}: PaperCardProps) {
  const statusLabel =
    paper.enhanceStatus !== 'idle'
      ? `Enhance ${paper.enhanceStatus}`
      : paper.recommendStatus !== 'idle'
        ? `Recommend ${paper.recommendStatus}`
        : null

  const isInteractive = !!onOpenDetail

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onOpenDetail) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpenDetail()
    }
  }

  return (
    <Card
      className={`group relative flex flex-col gap-4 overflow-hidden p-5 ${
        isInteractive
          ? 'cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-custom-500/40'
          : ''
      }`}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onOpenDetail}
      onKeyDown={handleCardKeyDown}
    >
      {/* Header row: source tags + favorite */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {paper.source && (
            <TagChip
              icon="tabler:rss"
              label={paper.source}
              variant="filled"
            />
          )}
          {paper.journal && (
            <TagChip
              icon="tabler:book"
              label={paper.journal}
              variant="outlined"
            />
          )}
          {statusLabel && (
            <TagChip
              icon="tabler:sparkles"
              label={statusLabel}
              variant="outlined"
            />
          )}
        </div>
        <Button
          className="p-2!"
          icon={paper.isFavorite ? 'tabler:star-filled' : 'tabler:star'}
          loading={favoriteLoading}
          variant="plain"
          onClick={event => {
            event.stopPropagation()
            void onToggleFavorite()
          }}
        />
      </div>

      {/* Title + Score */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl leading-8 font-bold tracking-tight">
            {paper.translatedTitle || paper.title}
          </h2>
          {typeof paper.score === 'number' && (
            <div className="bg-custom-500/10 text-custom-500 border-custom-500/20 flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold">
              <Icon className="size-3.5" icon="tabler:chart-dots-3" />
              {paper.score.toFixed(2)}
            </div>
          )}
        </div>
        {paper.translatedTitle && paper.translatedTitle !== paper.title && (
          <p className="text-bg-500 text-sm italic">{paper.title}</p>
        )}
        <p className="text-bg-500 text-sm">{formatAuthors(paper.authors)}</p>
      </div>

      {/* Metadata row */}
      <div className="text-bg-500 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1">
          <Icon className="size-3" icon="tabler:calendar-download" />
          {formatPaperDate(paper.fetchedAt)}
        </span>
        <Icon className="size-1 shrink-0" icon="tabler:circle-filled" />
        <span className="inline-flex items-center gap-1">
          <Icon className="size-3" icon="tabler:calendar-event" />
          {formatPaperDate(paper.publishedAt)}
        </span>
      </div>

      {/* TL;DR */}
      <div className="from-component-bg-lighter/50 to-transparent rounded-lg bg-gradient-to-br p-4">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Icon className="text-custom-500 size-4" icon="tabler:bulb" />
          <p className="text-xs font-semibold tracking-[0.12em] uppercase text-bg-500">TL;DR</p>
        </div>
        <p className="text-bg-500 line-clamp-5 text-sm leading-7">
          {paper.tldr || 'No TL;DR available for this paper yet.'}
        </p>
      </div>

      {/* Tags footer */}
      {(paper.matchedCollections.length > 0 || paper.keywords.length > 0) && (
        <div className="border-bg-500/10 flex flex-wrap gap-2 border-t pt-4">
          {paper.matchedCollections.slice(0, 3).map(collection => (
            <TagChip
              key={collection}
              icon="tabler:folders"
              label={collection}
              variant="outlined"
            />
          ))}
          {paper.keywords.slice(0, 3).map(keyword => (
            <TagChip
              key={keyword}
              icon="tabler:hash"
              label={keyword}
              variant="outlined"
            />
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="border-bg-500/10 flex flex-wrap items-center gap-2 border-t pt-4">
        {isInteractive ? (
          <Button
            icon="tabler:arrow-right"
            variant="secondary"
            onClick={event => {
              event.stopPropagation()
              onOpenDetail()
            }}
          >
            Open
          </Button>
        ) : detailTo ? (
          <Button as={Link} icon="tabler:arrow-right" variant="secondary" to={detailTo}>
            Open
          </Button>
        ) : null}
        {secondaryAction ? (
          <div onClick={event => { event.stopPropagation() }}>
            {secondaryAction}
          </div>
        ) : null}
      </div>
    </Card>
  )
}

export default PaperCard
