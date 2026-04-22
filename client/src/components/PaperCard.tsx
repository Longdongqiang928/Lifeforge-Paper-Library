import { Button, Card, TagChip } from 'lifeforge-ui'
import { Link } from 'shared'

import { formatAuthors, formatPaperDate } from '@/utils/papers'
import type { PaperListItem } from '@/utils/types'

interface PaperCardProps {
  paper: PaperListItem
  detailTo: string
  onToggleFavorite: () => void | Promise<void>
  favoriteLoading?: boolean
  secondaryAction?: React.ReactNode
}

function PaperCard({
  paper,
  detailTo,
  onToggleFavorite,
  favoriteLoading = false,
  secondaryAction
}: PaperCardProps) {
  const statusLabel =
    paper.enhanceStatus !== 'idle'
      ? `Enhance ${paper.enhanceStatus}`
      : paper.recommendStatus !== 'idle'
        ? `Recommend ${paper.recommendStatus}`
        : null

  return (
    <Card className="from-component-bg to-component-bg-lighter flex h-full flex-col gap-4 bg-gradient-to-br">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <TagChip
            icon="tabler:database-import"
            label={`Fetched ${formatPaperDate(paper.fetchedAt)}`}
            variant="outlined"
          />
          <TagChip
            icon="tabler:calendar"
            label={`Published ${formatPaperDate(paper.publishedAt)}`}
          />
          {paper.source && (
            <TagChip icon="tabler:rss" label={paper.source} variant="filled" />
          )}
          {paper.journal && (
            <TagChip
              icon="tabler:book"
              label={paper.journal}
              variant="outlined"
            />
          )}
          {typeof paper.score === 'number' && (
            <TagChip
              icon="tabler:chart-bar"
              label={`Score ${paper.score.toFixed(2)}`}
              variant="filled"
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
          onClick={onToggleFavorite}
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{paper.translatedTitle || paper.title}</h2>
        {paper.translatedTitle && paper.translatedTitle !== paper.title && (
          <p className="text-bg-500 text-sm">{paper.title}</p>
        )}
        <p className="text-bg-500 text-sm">{formatAuthors(paper.authors)}</p>
      </div>

      <p className="text-bg-500 line-clamp-4 flex-1 text-sm leading-6">
        {paper.tldr || 'No TL;DR available for this paper yet.'}
      </p>

      {(paper.matchedCollections.length > 0 || paper.keywords.length > 0) && (
        <div className="border-bg-500/10 flex flex-wrap gap-2 border-t pt-3">
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

      <div className="border-bg-500/10 flex flex-wrap items-center gap-2 border-t pt-3">
        <Button as={Link} icon="tabler:arrow-right" to={detailTo}>
          Open
        </Button>
        {secondaryAction}
      </div>
    </Card>
  )
}

export default PaperCard
