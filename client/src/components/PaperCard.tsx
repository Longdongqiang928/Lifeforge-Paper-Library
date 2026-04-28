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

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onOpenDetail) return

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpenDetail()
    }
  }

  return (
    <Card
      className={`border-bg-500/10 from-component-bg to-component-bg-lighter flex h-full flex-col gap-5 border bg-gradient-to-br ${
        onOpenDetail
          ? 'cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl'
          : ''
      }`}
      role={onOpenDetail ? 'button' : undefined}
      tabIndex={onOpenDetail ? 0 : undefined}
      onClick={onOpenDetail}
      onKeyDown={handleCardKeyDown}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {paper.source && <TagChip icon="tabler:rss" label={paper.source} variant="filled" />}
            {paper.journal && <TagChip icon="tabler:book" label={paper.journal} variant="outlined" />}
            {statusLabel && (
              <TagChip icon="tabler:sparkles" label={statusLabel} variant="outlined" />
            )}
          </div>
          <div className="text-bg-500 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>Fetched {formatPaperDate(paper.fetchedAt)}</span>
            <span>Published {formatPaperDate(paper.publishedAt)}</span>
          </div>
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

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl leading-8 font-semibold">{paper.translatedTitle || paper.title}</h2>
          {typeof paper.score === 'number' && (
            <div className="bg-component-bg-lighter text-primary rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap">
              {paper.score.toFixed(2)}
            </div>
          )}
        </div>
        {paper.translatedTitle && paper.translatedTitle !== paper.title && (
          <p className="text-bg-500 text-sm">{paper.title}</p>
        )}
        <p className="text-bg-500 text-sm leading-6">{formatAuthors(paper.authors)}</p>
      </div>

      <p className="text-bg-500 line-clamp-5 flex-1 text-sm leading-7">
        {paper.tldr || 'No TL;DR available for this paper yet.'}
      </p>

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

      <div className="border-bg-500/10 flex flex-wrap items-center gap-2 border-t pt-4">
        {onOpenDetail ? (
          <Button
            icon="tabler:arrow-right"
            onClick={event => {
              event.stopPropagation()
              onOpenDetail()
            }}
          >
            Open
          </Button>
        ) : detailTo ? (
          <Button as={Link} icon="tabler:arrow-right" to={detailTo}>
            Open
          </Button>
        ) : null}
        {secondaryAction ? (
          <div
            onClick={event => {
              event.stopPropagation()
            }}
          >
            {secondaryAction}
          </div>
        ) : null}
      </div>
    </Card>
  )
}

export default PaperCard
