import { Icon } from '@iconify/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Button,
  Card,
  DateInput,
  ModuleHeader,
  Switch,
  TagChip,
  TextAreaInput,
  TextInput,
  WithQuery
} from 'lifeforge-ui'
import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'

import forgeAPI from '@/utils/forgeAPI'
import { MODULE_ROUTE_KEY } from '@/utils/module'
import type { ActivePipelineRun, PipelineRun } from '@/utils/types'

const STAGES = [
  { id: 'fetch', label: 'Fetch', icon: 'tabler:rss' },
  { id: 'abstract', label: 'Abstract', icon: 'tabler:file-text' },
  { id: 'recommend', label: 'Recommend', icon: 'tabler:chart-dots-3' },
  { id: 'enhance', label: 'Enhance', icon: 'tabler:sparkles' }
] as const

const SETTINGS_TABS = [
  { id: 'pipeline', label: 'Select stages and launch', icon: 'tabler:player-play' },
  { id: 'shared', label: 'Shared configurations', icon: 'tabler:adjustments' },
  { id: 'personal', label: 'Personal configurations', icon: 'tabler:user-cog' }
] as const

function StatusBadge({ status }: { status: string }) {
  const scheme: Record<string, string> = {
    completed: 'bg-emerald-500/20 text-emerald-500',
    running: 'bg-blue-500/20 text-blue-500',
    failed: 'bg-red-500/20 text-red-500'
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        scheme[status] || 'bg-custom-500/20 text-custom-500'
      }`}
    >
      {status}
    </span>
  )
}

function SettingsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<(typeof SETTINGS_TABS)[number]['id']>('pipeline')

  const [selectedStages, setSelectedStages] = useState<string[]>(['fetch'])
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')

  const [rssSources, setRssSources] = useState('')
  const [fetchEnabled, setFetchEnabled] = useState(false)
  const [fetchTime, setFetchTime] = useState('08:00')
  const [abstractEnabled, setAbstractEnabled] = useState(false)
  const [abstractTime, setAbstractTime] = useState('10:00')
  const [abstractLookbackDays, setAbstractLookbackDays] = useState('1')
  const [natureApiKey, setNatureApiKey] = useState('')
  const [tavilyApiKey, setTavilyApiKey] = useState('')

  const [zoteroUserId, setZoteroUserId] = useState('')
  const [zoteroApiKey, setZoteroApiKey] = useState('')
  const [aiBaseUrl, setAiBaseUrl] = useState('')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [embeddingModel, setEmbeddingModel] = useState('')
  const [outputLanguage, setOutputLanguage] = useState('')
  const [enhanceThreshold, setEnhanceThreshold] = useState('3.6')
  const [recommendEnabled, setRecommendEnabled] = useState(false)
  const [recommendTime, setRecommendTime] = useState('09:00')
  const [enhanceEnabled, setEnhanceEnabled] = useState(false)
  const [enhanceTime, setEnhanceTime] = useState('09:30')
  const [recommendLookbackDays, setRecommendLookbackDays] = useState('7')
  const [enhanceLookbackDays, setEnhanceLookbackDays] = useState('3')

  const fetchSettingsQuery = useQuery(
    forgeAPI.pipeline.settings.fetch.get.queryOptions({
      queryKey: [MODULE_ROUTE_KEY, 'pipeline', 'settings', 'fetch']
    })
  )

  const personalSettingsQuery = useQuery(
    forgeAPI.pipeline.settings.personal.get.queryOptions({
      queryKey: [MODULE_ROUTE_KEY, 'pipeline', 'settings', 'personal']
    })
  )

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
        queryClient.invalidateQueries({ queryKey: [MODULE_ROUTE_KEY, 'pipeline'] })
        queryClient.invalidateQueries({ queryKey: [MODULE_ROUTE_KEY, 'papers'] })
      },
      onError: error => {
        toast.error(error instanceof Error ? error.message : 'Failed to start pipeline')
      }
    })
  )

  const fetchMutation = useMutation(
    forgeAPI.pipeline.settings.fetch.update.mutationOptions({
      onSuccess: () => {
        toast.success('Fetch settings saved')
        setNatureApiKey('')
        setTavilyApiKey('')
        queryClient.invalidateQueries({ queryKey: [MODULE_ROUTE_KEY, 'pipeline', 'settings', 'fetch'] })
      },
      onError: error => {
        toast.error(error instanceof Error ? error.message : 'Failed to save fetch settings')
      }
    })
  )

  const personalMutation = useMutation(
    forgeAPI.pipeline.settings.personal.update.mutationOptions({
      onSuccess: () => {
        toast.success('Personal settings saved')
        setZoteroApiKey('')
        setAiApiKey('')
        queryClient.invalidateQueries({ queryKey: [MODULE_ROUTE_KEY, 'pipeline', 'settings', 'personal'] })
      },
      onError: error => {
        toast.error(error instanceof Error ? error.message : 'Failed to save personal settings')
      }
    })
  )

  useEffect(() => {
    if (!fetchSettingsQuery.data) return
    setRssSources(fetchSettingsQuery.data.rssSources)
    setFetchEnabled(fetchSettingsQuery.data.fetchEnabled)
    setFetchTime(fetchSettingsQuery.data.fetchTime)
    setAbstractEnabled(fetchSettingsQuery.data.abstractEnabled)
    setAbstractTime(fetchSettingsQuery.data.abstractTime)
    setAbstractLookbackDays(String(fetchSettingsQuery.data.abstractLookbackDays))
  }, [fetchSettingsQuery.data])

  useEffect(() => {
    if (!personalSettingsQuery.data) return
    setZoteroUserId(personalSettingsQuery.data.zoteroUserId)
    setAiBaseUrl(personalSettingsQuery.data.aiBaseUrl)
    setAiModel(personalSettingsQuery.data.aiModel)
    setEmbeddingModel(personalSettingsQuery.data.embeddingModel)
    setOutputLanguage(personalSettingsQuery.data.outputLanguage)
    setEnhanceThreshold(String(personalSettingsQuery.data.enhanceThreshold))
    setRecommendEnabled(personalSettingsQuery.data.recommendEnabled)
    setRecommendTime(personalSettingsQuery.data.recommendTime)
    setEnhanceEnabled(personalSettingsQuery.data.enhanceEnabled)
    setEnhanceTime(personalSettingsQuery.data.enhanceTime)
    setRecommendLookbackDays(String(personalSettingsQuery.data.recommendLookbackDays))
    setEnhanceLookbackDays(String(personalSettingsQuery.data.enhanceLookbackDays))
  }, [personalSettingsQuery.data])

  const hasRangeStage = selectedStages.some(stage => stage !== 'fetch')
  const selectedStageLabels = selectedStages
    .map(stage => STAGES.find(item => item.id === stage)?.label)
    .filter(Boolean)
    .join(', ')
  const recentRuns = (runsQuery.data ?? []).slice(0, 15)
  const scheduleItems = [
    { id: 'fetch', label: 'Fetch', time: fetchTime, enabled: fetchEnabled, setTime: setFetchTime, setEnabled: setFetchEnabled },
    { id: 'abstract', label: 'Abstract', time: abstractTime, enabled: abstractEnabled, setTime: setAbstractTime, setEnabled: setAbstractEnabled },
    { id: 'recommend', label: 'Recommend', time: recommendTime, enabled: recommendEnabled, setTime: setRecommendTime, setEnabled: setRecommendEnabled },
    { id: 'enhance', label: 'Enhance', time: enhanceTime, enabled: enhanceEnabled, setTime: setEnhanceTime, setEnabled: setEnhanceEnabled }
  ] as const

  const saveSchedules = () => {
    fetchMutation.mutate({
      rssSources,
      fetchEnabled,
      fetchTime,
      abstractEnabled,
      abstractTime,
      abstractLookbackDays: Number(abstractLookbackDays) || 1
    })
    personalMutation.mutate({
      zoteroUserId,
      aiBaseUrl,
      aiModel,
      embeddingModel,
      outputLanguage,
      enhanceThreshold: Number(enhanceThreshold) || 0,
      recommendEnabled,
      recommendTime,
      enhanceEnabled,
      enhanceTime,
      recommendLookbackDays: Number(recommendLookbackDays) || 1,
      enhanceLookbackDays: Number(enhanceLookbackDays) || 1
    })
  }

  return (
    <>
      <ModuleHeader icon="tabler:settings" title="Settings" />

      <div className="flex h-full min-h-0 flex-1 flex-col gap-6 overflow-y-auto pb-6 pr-1">
        <Card className="border border-bg-500/10 bg-component-bg/80 p-0 shadow-sm">
          <div className="grid min-h-[520px] gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="border-b border-bg-500/10 bg-component-bg-lighter/35 p-4 lg:border-r lg:border-b-0">
              <div className="grid gap-2 lg:flex lg:flex-col">
                {SETTINGS_TABS.map(tab => (
                  <button
                    key={tab.id}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-custom-500/15 text-custom-500'
                        : 'text-bg-500 hover:bg-component-bg hover:text-bg'
                    }`}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon className="size-4 shrink-0" icon={tab.icon} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="min-w-0 p-5 lg:p-6">
              {activeTab === 'pipeline' && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold">Select stages and launch</h2>
                      <TagChip icon="tabler:stack-2" label={selectedStageLabels || 'No stage'} variant="filled" />
                      <TagChip icon="tabler:calendar-time" label={hasRangeStage ? 'Range enabled' : 'Fetch only'} variant="outlined" />
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
                      <span>Run now</span>
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Stages</p>
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

                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                    <div>
                      <label className="mb-2 block text-xs font-medium text-bg-500">Range start</label>
                      <DateInput
                        disabled={!hasRangeStage}
                        value={rangeStart ? dayjs(rangeStart).toDate() : null}
                        variant="plain"
                        onChange={value => {
                          setRangeStart(value ? dayjs(value).format('YYYY-MM-DD') : '')
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-bg-500">Range end</label>
                      <DateInput
                        disabled={!hasRangeStage}
                        value={rangeEnd ? dayjs(rangeEnd).toDate() : null}
                        variant="plain"
                        onChange={value => {
                          setRangeEnd(value ? dayjs(value).format('YYYY-MM-DD') : '')
                        }}
                      />
                    </div>
                    <Button
                      icon="tabler:device-floppy"
                      loading={fetchMutation.isPending || personalMutation.isPending}
                      variant="secondary"
                      onClick={saveSchedules}
                    >
                      <span>Save schedules</span>
                    </Button>
                  </div>

                  <div className="grid grid-cols-4 gap-3 overflow-x-auto pb-1">
                    {scheduleItems.map(item => (
                      <div key={item.id} className="min-w-44 rounded-2xl border border-bg-500/10 bg-component-bg-lighter/50 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">{item.label}</p>
                          <Switch value={item.enabled} onChange={item.setEnabled} />
                        </div>
                        <TextInput placeholder="08:00" value={item.time} variant="plain" onChange={item.setTime} />
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_1.6fr]">
                    <div className="rounded-2xl border border-bg-500/10 bg-component-bg-lighter/50 p-4">
                      <p className="text-xs font-semibold tracking-[0.12em] uppercase text-bg-500">Active runs</p>
                      <WithQuery query={activeRunsQuery}>
                        {(activeRuns: ActivePipelineRun[]) =>
                          activeRuns.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {activeRuns.map(run => (
                                <TagChip key={run.id} icon="tabler:clock-play" label={`${run.stage} (${run.scope})`} variant="filled" />
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-bg-500">No active runs</p>
                          )
                        }
                      </WithQuery>
                    </div>
                    <div className="rounded-2xl border border-bg-500/10 bg-component-bg-lighter/50 p-4">
                      <p className="text-xs font-semibold tracking-[0.12em] uppercase text-bg-500">Execution rule</p>
                      <p className="mt-3 text-sm text-bg-500">Fetch ignores the date range. Other stages use fetched time window.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'shared' && (
                <WithQuery query={fetchSettingsQuery}>
                  {fetchSettings => (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-semibold">Shared configurations</h2>
                        <TagChip icon="tabler:shield" label="Admin scope" variant="outlined" />
                      </div>

                      <TextAreaInput
                        className="min-h-36"
                        placeholder="arxiv:physics+quant-ph+cond-mat,nature:nature+nphoton+nphys,science:science+sciadv"
                        value={rssSources}
                        variant="plain"
                        onChange={setRssSources}
                      />

                      <div className="grid gap-4 lg:grid-cols-2">
                        <TextInput
                          label="Nature API key"
                          placeholder={fetchSettings.hasNatureApiKey ? 'Already configured' : 'Springer Nature API key'}
                          value={natureApiKey}
                          variant="plain"
                          onChange={setNatureApiKey}
                        />
                        <TextInput
                          label="Tavily API key"
                          placeholder={fetchSettings.hasTavilyApiKey ? 'Already configured' : 'Tavily API key'}
                          value={tavilyApiKey}
                          variant="plain"
                          onChange={setTavilyApiKey}
                        />
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <TextInput
                          label="Abstract lookback days"
                          placeholder="1"
                          value={abstractLookbackDays}
                          variant="plain"
                          onChange={setAbstractLookbackDays}
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          icon="tabler:device-floppy"
                          loading={fetchMutation.isPending}
                          onClick={() => {
                            fetchMutation.mutate({
                              rssSources,
                              fetchEnabled,
                              fetchTime,
                              abstractEnabled,
                              abstractTime,
                              abstractLookbackDays: Number(abstractLookbackDays) || 1,
                              natureApiKey: natureApiKey.trim() ? natureApiKey : undefined,
                              tavilyApiKey: tavilyApiKey.trim() ? tavilyApiKey : undefined
                            })
                          }}
                        >
                          <span>Save fetch settings</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </WithQuery>
              )}

              {activeTab === 'personal' && (
                <WithQuery query={personalSettingsQuery}>
                  {personalSettings => (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-semibold">Personal configurations</h2>
                        <TagChip icon="tabler:user" label="User scope" variant="outlined" />
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <TextInput label="Zotero user ID" placeholder="1234567" value={zoteroUserId} variant="plain" onChange={setZoteroUserId} />
                        <TextInput
                          label="Zotero API key"
                          placeholder={personalSettings.hasZoteroApiKey ? 'Already configured' : 'Zotero web API key'}
                          value={zoteroApiKey}
                          variant="plain"
                          onChange={setZoteroApiKey}
                        />
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <TextInput label="AI base URL" placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" value={aiBaseUrl} variant="plain" onChange={setAiBaseUrl} />
                        <TextInput label="AI API key" placeholder={personalSettings.hasAiApiKey ? 'Already configured' : 'API key'} value={aiApiKey} variant="plain" onChange={setAiApiKey} />
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <TextInput label="Chat model" placeholder="qwen3-30b-a3b-instruct-2507" value={aiModel} variant="plain" onChange={setAiModel} />
                        <TextInput label="Embedding model" placeholder="qwen3-embedding-8b-f16" value={embeddingModel} variant="plain" onChange={setEmbeddingModel} />
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <TextInput label="Output language" placeholder="Chinese" value={outputLanguage} variant="plain" onChange={setOutputLanguage} />
                        <TextInput label="Enhance threshold" placeholder="3.6" value={enhanceThreshold} variant="plain" onChange={setEnhanceThreshold} />
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <TextInput label="Recommend lookback days" placeholder="7" value={recommendLookbackDays} variant="plain" onChange={setRecommendLookbackDays} />
                        <TextInput label="Enhance lookback days" placeholder="3" value={enhanceLookbackDays} variant="plain" onChange={setEnhanceLookbackDays} />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          icon="tabler:device-floppy"
                          loading={personalMutation.isPending}
                          onClick={() => {
                            personalMutation.mutate({
                              zoteroUserId,
                              zoteroApiKey: zoteroApiKey.trim() ? zoteroApiKey : undefined,
                              aiBaseUrl,
                              aiApiKey: aiApiKey.trim() ? aiApiKey : undefined,
                              aiModel,
                              embeddingModel,
                              outputLanguage,
                              enhanceThreshold: Number(enhanceThreshold) || 0,
                              recommendEnabled,
                              recommendTime,
                              enhanceEnabled,
                              enhanceTime,
                              recommendLookbackDays: Number(recommendLookbackDays) || 1,
                              enhanceLookbackDays: Number(enhanceLookbackDays) || 1
                            })
                          }}
                        >
                          <span>Save personal settings</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </WithQuery>
              )}
            </div>
          </div>
        </Card>

        <Card className="space-y-4 border border-bg-500/10 bg-component-bg/80 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Recent executions</h2>
              <p className="text-bg-500 text-sm">Latest pipeline activity and result counts.</p>
            </div>
            <Button
              icon="tabler:refresh"
              variant="secondary"
              onClick={() => {
                void runsQuery.refetch()
              }}
            >
              <span>Refresh</span>
            </Button>
          </div>

          <WithQuery query={runsQuery}>
            {(data: PipelineRun[]) =>
              data.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-bg-500/20 p-8 text-center text-sm text-bg-500">
                  No pipeline runs yet. Use the launch controls above to start one.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-bg-500/10">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-bg-500/10 bg-component-bg-lighter/50">
                          <th className="px-4 py-3 text-left text-xs font-semibold tracking-[0.12em] uppercase text-bg-500">Time</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold tracking-[0.12em] uppercase text-bg-500">Stage</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold tracking-[0.12em] uppercase text-bg-500">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold tracking-[0.12em] uppercase text-bg-500">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-bg-500/5">
                        {recentRuns.map(run => (
                          <tr key={run.id} className="transition-colors hover:bg-component-bg-lighter/40">
                            <td className="px-4 py-3 text-sm whitespace-nowrap">{dayjs(run.created).format('YY/MM-DD h:mm A')}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 text-sm font-medium capitalize">
                                {run.stage}
                                <span className="text-xs font-normal text-bg-400">({run.scope})</span>
                              </span>
                            </td>
                            <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center gap-2 text-xs">
                                <span className="font-medium text-emerald-500">{run.insertedCount} in</span>
                                <span className="text-bg-400">|</span>
                                <span className="font-medium">{run.skippedCount} skip</span>
                                <span className="text-bg-400">|</span>
                                <span className="font-medium text-red-500">{run.failedCount} fail</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            }
          </WithQuery>
        </Card>
      </div>
    </>
  )
}

export default SettingsPage
