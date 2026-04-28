import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Button,
  Card,
  DateInput,
  EmptyStateScreen,
  ModuleHeader,
  TagChip,
  WithQuery
} from 'lifeforge-ui'
import { useState } from 'react'
import { toast } from 'react-toastify'

import ModuleSubnav from '@/components/ModuleSubnav'
import forgeAPI from '@/utils/forgeAPI'
import {
  MODULE_NAMESPACE,
  MODULE_ROUTE_KEY
} from '@/utils/module'
import type { ActivePipelineRun, PipelineRun } from '@/utils/types'

const STAGES = [
  { id: 'fetch', label: 'Fetch', icon: 'tabler:rss' },
  { id: 'abstract', label: 'Abstract', icon: 'tabler:file-text' },
  { id: 'recommend', label: 'Recommend', icon: 'tabler:chart-dots-3' },
  { id: 'enhance', label: 'Enhance', icon: 'tabler:sparkles' }
] as const

function asRunDetails(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  return value as Record<string, unknown>
}

function asDetailNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function StatCard({
  icon,
  label,
  value,
  description
}: {
  icon: string
  label: string
  value: string
  description: string
}) {
  return (
    <Card className="border-bg-500/10 component-bg-lighter space-y-2 border p-4">
      <TagChip icon={icon} label={label} variant="outlined" />
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-bg-500 text-sm">{description}</p>
    </Card>
  )
}

function RunCard({ run }: { run: PipelineRun }) {
  const details = asRunDetails(run.details)
  const skippedRecommendNoAbstract = asDetailNumber(details?.skippedNoAbstract)
  const skippedNoStateOrNoAbstract = asDetailNumber(details?.skippedNoStateOrNoAbstract)
  const skippedBelowThreshold = asDetailNumber(details?.skippedBelowThreshold)
  const skippedEnhanceAlreadyCompletedUnchanged = asDetailNumber(
    details?.skippedAlreadyCompletedUnchanged
  )
  const skippedRecommendAlreadyCompletedUnchanged = asDetailNumber(
    details?.skippedAlreadyCompletedUnchanged
  )

  return (
    <Card className="border-bg-500/10 from-component-bg to-component-bg-lighter space-y-4 border bg-gradient-to-br">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">{run.triggeredBy}</p>
          <h3 className="text-lg font-semibold capitalize">{run.stage}</h3>
          <p className="text-bg-500 text-sm">{new Date(run.created).toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TagChip icon="tabler:stack-2" label={run.scope} variant="outlined" />
          <TagChip icon="tabler:bolt" label={run.triggeredBy} variant="outlined" />
          <TagChip icon="tabler:status-change" label={run.status} variant="filled" />
        </div>
      </div>

      {(run.rangeStart || run.rangeEnd) && (
        <p className="text-bg-500 text-sm">
          Range: {run.rangeStart ? new Date(run.rangeStart).toLocaleDateString() : '...'} to{' '}
          {run.rangeEnd ? new Date(run.rangeEnd).toLocaleDateString() : '...'}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-5">
        <div>
          <p className="text-bg-500 text-xs uppercase">Processed</p>
          <p className="text-lg font-semibold">{run.processedTotal}</p>
        </div>
        <div>
          <p className="text-bg-500 text-xs uppercase">Inserted</p>
          <p className="text-lg font-semibold">{run.insertedCount}</p>
        </div>
        <div>
          <p className="text-bg-500 text-xs uppercase">Updated</p>
          <p className="text-lg font-semibold">{run.updatedCount}</p>
        </div>
        <div>
          <p className="text-bg-500 text-xs uppercase">Skipped</p>
          <p className="text-lg font-semibold">{run.skippedCount}</p>
        </div>
        <div>
          <p className="text-bg-500 text-xs uppercase">Failed</p>
          <p className="text-lg font-semibold">{run.failedCount}</p>
        </div>
      </div>

      {(skippedRecommendNoAbstract !== undefined ||
        skippedNoStateOrNoAbstract !== undefined ||
        skippedBelowThreshold !== undefined ||
        skippedRecommendAlreadyCompletedUnchanged !== undefined ||
        skippedEnhanceAlreadyCompletedUnchanged !== undefined) && (
      <div className="bg-bg-100 dark:bg-bg-900 grid gap-3 rounded-lg p-3 sm:grid-cols-3">
          {run.stage === 'recommend' && skippedRecommendNoAbstract !== undefined && (
            <div>
              <p className="text-bg-500 text-xs uppercase">Skip: No abstract</p>
              <p className="text-base font-semibold">{skippedRecommendNoAbstract}</p>
            </div>
          )}
          {run.stage === 'enhance' && skippedNoStateOrNoAbstract !== undefined && (
            <div>
              <p className="text-bg-500 text-xs uppercase">Skip: No state / no abstract</p>
              <p className="text-base font-semibold">{skippedNoStateOrNoAbstract}</p>
            </div>
          )}
          {skippedBelowThreshold !== undefined && (
            <div>
              <p className="text-bg-500 text-xs uppercase">Skip: Below threshold</p>
              <p className="text-base font-semibold">{skippedBelowThreshold}</p>
            </div>
          )}
          {run.stage === 'recommend' && skippedRecommendAlreadyCompletedUnchanged !== undefined && (
            <div>
              <p className="text-bg-500 text-xs uppercase">Skip: Already recommended / unchanged</p>
              <p className="text-base font-semibold">{skippedRecommendAlreadyCompletedUnchanged}</p>
            </div>
          )}
          {run.stage === 'enhance' && skippedEnhanceAlreadyCompletedUnchanged !== undefined && (
            <div>
              <p className="text-bg-500 text-xs uppercase">Skip: Already enhanced / unchanged</p>
              <p className="text-base font-semibold">{skippedEnhanceAlreadyCompletedUnchanged}</p>
            </div>
          )}
        </div>
      )}

      {run.errorSummary && (
        <div className="bg-bg-100 dark:bg-bg-900 rounded-lg p-3 text-sm">
          {run.errorSummary}
        </div>
      )}
    </Card>
  )
}

function RunPage() {
  const queryClient = useQueryClient()
  const [selectedStages, setSelectedStages] = useState<string[]>(['fetch'])
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')

  const runsQuery = useQuery(
    forgeAPI.pipeline.runs.list.queryOptions({
      queryKey: [MODULE_ROUTE_KEY, 'pipeline', 'runs']
    })
  )

  const activeRunsQuery = useQuery(
    forgeAPI.pipeline.runs.active.queryOptions({
      queryKey: [MODULE_ROUTE_KEY, 'pipeline', 'runs', 'active']
    })
  )

  const triggerMutation = useMutation(
    forgeAPI.pipeline.runs.trigger.mutationOptions({
      onSuccess: () => {
        toast.success('Pipeline started')
        queryClient.invalidateQueries({
          queryKey: [MODULE_ROUTE_KEY, 'pipeline']
        })
        queryClient.invalidateQueries({
          queryKey: [MODULE_ROUTE_KEY, 'papers']
        })
      },
      onError: error => {
        toast.error(error instanceof Error ? error.message : 'Failed to start pipeline')
      }
    })
  )

  const hasRangeStage = selectedStages.some(stage => stage !== 'fetch')
  const selectedStageLabels = selectedStages
    .map(stage => STAGES.find(item => item.id === stage)?.label)
    .filter(Boolean)
    .join(', ')

  return (
    <>
      <ModuleHeader
        icon="tabler:player-play"
        namespace={MODULE_NAMESPACE}
        title="runPage"
      />
      <ModuleSubnav />

      <div className="space-y-4">
        <Card className="border-bg-500/10 from-component-bg-lighter to-component-bg space-y-5 border bg-gradient-to-br">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.9fr)]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <TagChip
                  icon="tabler:stack-2"
                  label={selectedStageLabels || 'No stage selected'}
                  variant="filled"
                />
                <TagChip
                  icon="tabler:calendar-time"
                  label={hasRangeStage ? 'Fetched-time range enabled' : 'Fetch only'}
                  variant="outlined"
                />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl leading-tight font-semibold">Pipeline orchestration</h2>
                <p className="text-bg-500 max-w-3xl text-sm leading-7">
                  Trigger fetch, abstract, recommend, and enhance with one consistent control surface.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <StatCard
                description="Runs currently holding the pipeline lock."
                icon="tabler:clock-play"
                label="Active"
                value={String(activeRunsQuery.data?.length ?? 0)}
              />
              <StatCard
                description="Recent run records visible to your account."
                icon="tabler:history"
                label="History"
                value={String(runsQuery.data?.length ?? 0)}
              />
              <StatCard
                description="Only recommend and enhance respect the selected fetched-time window."
                icon="tabler:calendar-search"
                label="Range rule"
                value={hasRangeStage ? 'Enabled' : 'Skipped'}
              />
            </div>
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <Card className="border-bg-500/10 space-y-5 border">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Run pipeline</h2>
              <p className="text-bg-500 text-sm">Fetch always runs for today. Later stages use fetched-time range.</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Stages</p>
              <div className="flex flex-wrap gap-2">
                {STAGES.map(stage => {
                  const selected = selectedStages.includes(stage.id)

                  return (
                    <TagChip
                      key={stage.id}
                      icon={stage.icon}
                      label={stage.label}
                      variant={selected ? 'filled' : 'outlined'}
                      onClick={() => {
                        setSelectedStages(current =>
                          current.includes(stage.id)
                            ? current.filter(item => item !== stage.id)
                            : [...current, stage.id]
                        )
                      }}
                    />
                  )
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-bg-500 block text-sm font-medium">
                  Range start
                </label>
                <DateInput
                  disabled={!hasRangeStage}
                  value={rangeStart ? dayjs(rangeStart).toDate() : null}
                  variant="plain"
                  onChange={value => {
                    setRangeStart(value ? dayjs(value).format('YYYY-MM-DD') : '')
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-bg-500 block text-sm font-medium">
                  Range end
                </label>
                <DateInput
                  disabled={!hasRangeStage}
                  value={rangeEnd ? dayjs(rangeEnd).toDate() : null}
                  variant="plain"
                  onChange={value => {
                    setRangeEnd(value ? dayjs(value).format('YYYY-MM-DD') : '')
                  }}
                />
              </div>
            </div>

            <div className="component-bg-lighter space-y-2 rounded-xl p-4">
              <p className="text-sm font-medium">Execution rule</p>
              <p className="text-bg-500 text-sm leading-6">
                Fetch ignores the date range. Abstract, recommend, and enhance use fetched time.
              </p>
            </div>

            <Button
              disabled={selectedStages.length === 0}
              icon="tabler:player-play"
              loading={triggerMutation.isPending}
              onClick={() => {
                triggerMutation.mutate({
                  stages: selectedStages as Array<'fetch' | 'abstract' | 'recommend' | 'enhance'>,
                  rangeStart: hasRangeStage && rangeStart ? dayjs(rangeStart).startOf('day').toISOString() : undefined,
                  rangeEnd: hasRangeStage && rangeEnd ? dayjs(rangeEnd).endOf('day').toISOString() : undefined
                })
              }}
            >
              Run selected stages
            </Button>

            <WithQuery query={activeRunsQuery}>
              {(activeRuns: ActivePipelineRun[]) =>
                activeRuns.length === 0 ? (
                  <div className="bg-bg-100 dark:bg-bg-900 rounded-lg p-4 text-sm">
                    No active runs right now.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Active runs</p>
                    <div className="flex flex-wrap gap-2">
                      {activeRuns.map(run => (
                        <TagChip
                          key={run.id}
                          icon="tabler:clock-play"
                          label={`${run.stage} (${run.scope})`}
                          variant="filled"
                        />
                      ))}
                    </div>
                  </div>
                )
              }
            </WithQuery>
          </Card>

          <WithQuery query={runsQuery}>
            {(runs: PipelineRun[]) =>
              runs.length === 0 ? (
                <EmptyStateScreen
                  icon="tabler:history-off"
                  message={{
                    title: 'No runs yet',
                    description: 'Trigger fetch, abstract, recommend, or enhance to populate run history.'
                  }}
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Run history</p>
                      <h2 className="text-2xl font-semibold">Recent executions</h2>
                    </div>
                    <TagChip
                      icon="tabler:history"
                      label={`${runs.length} recent entries`}
                      variant="outlined"
                    />
                  </div>
                  {runs.map(run => (
                    <RunCard key={run.id} run={run} />
                  ))}
                </div>
              )
            }
          </WithQuery>
        </div>
      </div>
    </>
  )
}

export default RunPage
