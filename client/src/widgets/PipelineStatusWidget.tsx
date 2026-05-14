import { useQuery } from '@tanstack/react-query'
import { Icon } from '@iconify/react'
import clsx from 'clsx'
import dayjs from 'dayjs'
import { Button, Widget } from 'lifeforge-ui'
import { Link } from 'shared'
import type { WidgetConfig } from 'shared'

import forgeAPI from '@/utils/forgeAPI'
import { MODULE_BASE_PATH, MODULE_ROUTE_KEY } from '@/utils/module'
import type { ActivePipelineRun, PipelineRun } from '@/utils/types'

const STAGES = [
  { id: 'fetch' as const, label: 'Fetch', icon: 'tabler:rss' },
  { id: 'abstract' as const, label: 'Abstract', icon: 'tabler:file-text' },
  { id: 'recommend' as const, label: 'Recommend', icon: 'tabler:chart-dots-3' },
  { id: 'enhance' as const, label: 'Enhance', icon: 'tabler:sparkles' }
]

function StageRow({
  stage,
  activeRun,
  lastRun,
  compact
}: {
  stage: (typeof STAGES)[number]
  activeRun?: ActivePipelineRun
  lastRun?: PipelineRun
  compact: boolean
}) {
  const isRunning = !!activeRun
  const status = isRunning
    ? 'running'
    : lastRun
      ? lastRun.status
      : 'idle'

  let statusColor: string
  let statusLabel: string
  if (status === 'running') {
    statusColor = 'text-blue-500'
    statusLabel = 'Running'
  } else if (status === 'completed') {
    statusColor = 'text-emerald-500'
    statusLabel = 'Completed'
  } else if (status === 'failed') {
    statusColor = 'text-red-500'
    statusLabel = 'Failed'
  } else {
    statusColor = 'text-bg-400'
    statusLabel = '–'
  }

  return (
    <div
      className={clsx(
        'flex items-center gap-3 rounded-lg',
        compact ? 'px-2 py-1.5' : 'px-3 py-2',
        isRunning && 'bg-blue-500/5'
      )}
    >
      <Icon
        className={clsx('size-4 shrink-0', statusColor)}
        icon={stage.icon}
      />
      <span className={clsx('min-w-0 flex-1 text-sm font-medium', compact && 'text-xs')}>
        {stage.label}
      </span>
      <span
        className={clsx(
          'shrink-0 text-xs font-medium',
          statusColor,
          isRunning && 'animate-pulse'
        )}
      >
        {isRunning ? statusLabel : lastRun?.created
          ? `${statusLabel} · ${dayjs(lastRun.created).format(compact ? 'MM/DD HH:mm' : 'MM-DD HH:mm')}`
          : statusLabel
        }
      </span>
      {lastRun && status !== 'running' && !compact && (
        <div className="flex shrink-0 gap-1 text-xs text-bg-400">
          {lastRun.insertedCount > 0 && (
            <span className="text-emerald-500">+{lastRun.insertedCount}</span>
          )}
          {lastRun.failedCount > 0 && (
            <span className="text-red-500">!{lastRun.failedCount}</span>
          )}
        </div>
      )}
    </div>
  )
}

function PipelineStatusWidget({
  dimension: { h }
}: {
  dimension: { w: number; h: number }
}) {
  const compact = h < 2

  const activeRunsQuery = useQuery(
    forgeAPI.pipeline.runs.active.queryOptions({
      queryKey: [MODULE_ROUTE_KEY, 'widget', 'active']
    })
  )

  const runsQuery = useQuery(
    forgeAPI.pipeline.runs.list.queryOptions({
      queryKey: [MODULE_ROUTE_KEY, 'widget', 'runs']
    })
  )

  const activeByStage = new Map(
    (activeRunsQuery.data ?? []).map((r: ActivePipelineRun) => [r.stage, r])
  )

  const lastRunByStage = new Map<string, PipelineRun>()
  for (const run of runsQuery.data ?? []) {
    if (!lastRunByStage.has(run.stage)) {
      lastRunByStage.set(run.stage, run)
    }
  }

  return (
    <Widget
      actionComponent={
        <Button
          as={Link}
          className="mr-2 p-2!"
          icon="tabler:chevron-right"
          to={`${MODULE_BASE_PATH}/run`}
          variant="plain"
        />
      }
      className="pr-4"
      icon="tabler:chart-dots-3"
      namespace={false}
      title="Pipeline Status"
    >
      <div className="flex flex-1 flex-col gap-1">
        {STAGES.map(stage => (
          <StageRow
            key={stage.id}
            compact={compact}
            activeRun={activeByStage.get(stage.id)}
            lastRun={lastRunByStage.get(stage.id)}
            stage={stage}
          />
        ))}
      </div>
    </Widget>
  )
}

export default PipelineStatusWidget

export const config: WidgetConfig = {
  id: 'pipelineStatus',
  icon: 'tabler:chart-dots-3',
  minW: 2,
  minH: 1,
  maxH: 3
}
