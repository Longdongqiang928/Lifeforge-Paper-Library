import { Icon } from '@iconify/react'
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
      <Card className="overflow-hidden p-0">
        <div className="relative border-b border-bg-500/10 bg-gradient-to-br from-custom-500/10 via-component-bg to-component-bg-lighter/50 p-5 sm:p-6">
          <div className="absolute top-0 left-0 h-full w-1 bg-custom-500" />

          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {paper.source && <TagChip icon="tabler:rss" label={paper.source} variant="filled" />}
              {paper.journal && <TagChip icon="tabler:book" label={paper.journal} />}
              {typeof paper.score === 'number' && (
                <TagChip
                  icon="tabler:chart-bar"
                  label={`Score ${paper.score.toFixed(2)}`}
                  variant="filled"
                />
              )}
            </div>

            <div className="max-w-4xl space-y-3">
              <h1 className={compact ? 'text-3xl leading-10 font-semibold tracking-tight' : 'text-4xl leading-[1.15] font-semibold tracking-tight'}>
                {paper.translatedTitle || paper.title}
              </h1>
              {paper.translatedTitle && paper.translatedTitle !== paper.title && (
                <p className={`${compact ? 'text-base' : 'text-lg'} text-bg-500 leading-7`}>
                  {paper.title}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-bg-500/10 bg-component-bg/70 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-custom-500/20 bg-custom-500/10">
                  <Icon className="size-5 text-custom-500" icon="tabler:users" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold tracking-[0.16em] text-bg-500 uppercase">Authors</p>
                  <p className="text-bg-500 leading-7">{formatAuthors(paper.authors)}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 rounded-2xl border border-bg-500/10 bg-component-bg/65 p-4">
              {paper.fetchedAt && (
                <TagChip
                  icon="tabler:database-import"
                  label={`Fetched ${formatPaperDate(paper.fetchedAt)}`}
                  variant="outlined"
                />
              )}
              <TagChip icon="tabler:calendar" label={formatPaperDate(paper.publishedAt)} />
              {paper.doi && <TagChip icon="tabler:fingerprint" label={paper.doi} />}
            </div>

            <div className="flex flex-wrap gap-2">
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
                <Button as="a" href={paper.url} icon="tabler:world" target="_blank" variant="secondary">
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
          </div>
        </div>

        {(paper.matchedCollections.length > 0 || paper.keywords.length > 0) && (
          <div className="space-y-3 p-5 sm:p-6">
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
