import { Button, Card, TagChip } from 'lifeforge-ui'

import { formatAuthors, formatPaperDate } from '@/utils/papers'
import type { PaperDetail } from '@/utils/types'

interface PaperDetailContentProps {
  paper: PaperDetail
  favoriteLoading?: boolean
  onToggleFavorite: () => void | Promise<void>
  compact?: boolean
}

function PaperDetailContent({
  paper,
  favoriteLoading = false,
  onToggleFavorite,
  compact = false
}: PaperDetailContentProps) {
  return (
    <div className={`space-y-4 ${compact ? 'min-h-[22rem]' : ''}`}>
      <Card className="space-y-5">
        <div className="space-y-4">
          <h1 className={compact ? 'text-3xl leading-10 font-semibold' : 'text-4xl leading-[1.15] font-semibold'}>
            {paper.translatedTitle || paper.title}
          </h1>
          {paper.translatedTitle && paper.translatedTitle !== paper.title && (
            <p className={`${compact ? 'text-base' : 'text-lg'} text-bg-500 leading-7`}>
              {paper.title}
            </p>
          )}
          <p className="text-bg-500 leading-7">{formatAuthors(paper.authors)}</p>
        </div>

        <div className="bg-component-bg-lighter grid gap-3 rounded-2xl p-4 sm:grid-cols-2 xl:grid-cols-3">
          {paper.fetchedAt && (
            <TagChip
              icon="tabler:database-import"
              label={`Fetched ${formatPaperDate(paper.fetchedAt)}`}
              variant="outlined"
            />
          )}
          <TagChip icon="tabler:calendar" label={formatPaperDate(paper.publishedAt)} />
          {paper.source && <TagChip icon="tabler:rss" label={paper.source} variant="filled" />}
          {paper.journal && <TagChip icon="tabler:book" label={paper.journal} />}
          {paper.doi && <TagChip icon="tabler:fingerprint" label={paper.doi} />}
          {typeof paper.score === 'number' && (
            <TagChip
              icon="tabler:chart-bar"
              label={`Score ${paper.score.toFixed(2)}`}
              variant="filled"
            />
          )}
        </div>

        {(paper.matchedCollections.length > 0 || paper.keywords.length > 0) && (
          <div className="space-y-3">
            {paper.matchedCollections.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {paper.matchedCollections.map(collection => (
                  <TagChip key={collection} icon="tabler:folders" label={collection} />
                ))}
              </div>
            )}
            {paper.keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {paper.keywords.map(keyword => (
                  <TagChip key={keyword} icon="tabler:hash" label={keyword} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            icon={paper.isFavorite ? 'tabler:star-filled' : 'tabler:star'}
            loading={favoriteLoading}
            onClick={() => {
              void onToggleFavorite()
            }}
          >
            {paper.isFavorite ? 'Saved' : 'Save'}
          </Button>
          {paper.url && (
            <Button as="a" href={paper.url} icon="tabler:world" target="_blank">
              Abstract
            </Button>
          )}
          {paper.pdfUrl && (
            <Button
              as="a"
              href={paper.pdfUrl}
              icon="tabler:file-type-pdf"
              target="_blank"
              variant="secondary"
            >
              PDF
            </Button>
          )}
        </div>
      </Card>

      {paper.tldr && (
        <Card className="space-y-3">
          <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">TL;DR</p>
          <p className="text-base leading-8">{paper.tldr}</p>
        </Card>
      )}

      {paper.translatedTitle && (
        <Card className="space-y-3">
          <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Translated title</p>
          <p className="leading-8">{paper.translatedTitle}</p>
        </Card>
      )}

      {paper.translatedAbstract && (
        <Card className="space-y-3">
          <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Translated abstract</p>
          <p className="text-bg-500 leading-8">{paper.translatedAbstract}</p>
        </Card>
      )}

      {paper.abstract && (
        <Card className="space-y-3">
          <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Original abstract</p>
          <p className="text-bg-500 leading-8">{paper.abstract}</p>
        </Card>
      )}
    </div>
  )
}

export default PaperDetailContent
