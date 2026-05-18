import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Button,
  Card,
  DateInput,
  ModuleHeader,
  SidebarItem,
  SidebarWrapper,
  Switch,
  TagChip,
  TextAreaInput,
  TextInput,
  WithQuery
} from 'lifeforge-ui'
import { useEffect, useRef, useState } from 'react'
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
  const [activeSection, setActiveSection] = useState('pipeline')

  // Pipeline trigger state
  const [selectedStages, setSelectedStages] = useState<string[]>(['fetch'])
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')

  // Shared settings state
  const sharedRef = useRef<HTMLDivElement>(null)
  const personalRef = useRef<HTMLDivElement>(null)
  const executionsRef = useRef<HTMLDivElement>(null)
  const [rssSources, setRssSources] = useState('')
  const [fetchEnabled, setFetchEnabled] = useState(false)
  const [fetchTime, setFetchTime] = useState('08:00')
  const [abstractEnabled, setAbstractEnabled] = useState(false)
  const [abstractTime, setAbstractTime] = useState('10:00')
  const [abstractLookbackDays, setAbstractLookbackDays] = useState('1')
  const [natureApiKey, setNatureApiKey] = useState('')
  const [tavilyApiKey, setTavilyApiKey] = useState('')

  // Personal settings state
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

  // Queries
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

  // Mutations
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

  // Sync from server
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

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId)
    const refMap: Record<string, React.RefObject<HTMLDivElement | null>> = {
      shared: sharedRef,
      personal: personalRef,
      executions: executionsRef
    }
    const ref = refMap[sectionId]
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const hasRangeStage = selectedStages.some(stage => stage !== 'fetch')
  const selectedStageLabels = selectedStages
    .map(stage => STAGES.find(item => item.id === stage)?.label)
    .filter(Boolean)
    .join(', ')

  return (
    <>
      <ModuleHeader icon="tabler:settings" title="Settings" />

      <div className="flex size-full min-h-0 flex-1">
        <SidebarWrapper>
          <SidebarItem
            active={activeSection === 'pipeline'}
            icon="tabler:stack-2"
            label="Pipeline"
            namespace={false}
            onClick={() => scrollToSection('pipeline')}
          />
          <SidebarItem
            active={activeSection === 'shared'}
            icon="tabler:users"
            label="Shared config"
            namespace={false}
            onClick={() => scrollToSection('shared')}
          />
          <SidebarItem
            active={activeSection === 'personal'}
            icon="tabler:user"
            label="Personal config"
            namespace={false}
            onClick={() => scrollToSection('personal')}
          />
          <SidebarItem
            active={activeSection === 'executions'}
            icon="tabler:history"
            label="Recent executions"
            namespace={false}
            onClick={() => scrollToSection('executions')}
          />
        </SidebarWrapper>

        <div className="relative z-10 flex h-full flex-1 flex-col gap-8 xl:ml-8">
          {/* === Pipeline Stages: Configuration + Manual Trigger === */}
          <Card className="from-component-bg-lighter/50 to-component-bg space-y-6 border bg-gradient-to-br p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Select stages and launch</p>
                <h2 className="text-2xl font-semibold">Pipeline orchestration</h2>
              </div>
              <div className="flex items-center gap-2">
                <TagChip
                  icon="tabler:stack-2"
                  label={selectedStageLabels || 'No stage'}
                  variant="filled"
                />
                <TagChip
                  icon="tabler:calendar-time"
                  label={hasRangeStage ? 'Range enabled' : 'Fetch only'}
                  variant="outlined"
                />
              </div>
            </div>

            <div className="border-bg-500/10 space-y-5 border-t pt-5">
              {/* Stage selection */}
              <div>
                <p className="mb-2 text-sm font-medium">Stages to run</p>
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

              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                  <label className="text-bg-500 block text-xs font-medium">Range start</label>
                  <DateInput
                    disabled={!hasRangeStage}
                    value={rangeStart ? dayjs(rangeStart).toDate() : null}
                    variant="plain"
                    onChange={value => {
                      setRangeStart(value ? dayjs(value).format('YYYY-MM-DD') : '')
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-bg-500 block text-xs font-medium">Range end</label>
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
                  Run now
                </Button>
              </div>

              <div className="bg-component-bg-lighter space-y-2 rounded-xl border p-4">
                <p className="text-xs font-medium">Execution rule</p>
                <p className="text-bg-500 text-xs">Fetch ignores the date range. Other stages use fetched time window.</p>
              </div>

              {/* Active runs */}
              <WithQuery query={activeRunsQuery}>
                {(activeRuns: ActivePipelineRun[]) =>
                  activeRuns.length > 0 ? (
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
                  ) : (
                    <p className="text-bg-400 text-xs">No active runs</p>
                  )
                }
              </WithQuery>

              {/* Schedules */}
              <div className="border-bg-500/10 space-y-4 border-t pt-5">
                <p className="text-sm font-medium">Automatic schedules</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    { id: 'fetch', label: 'Fetch', desc: 'RSS harvesting', time: fetchTime, enabled: fetchEnabled, setTime: setFetchTime, setEnabled: setFetchEnabled },
                    { id: 'abstract', label: 'Abstract', desc: 'Backfill missing', time: abstractTime, enabled: abstractEnabled, setTime: setAbstractTime, setEnabled: setAbstractEnabled },
                    { id: 'recommend', label: 'Recommend', desc: 'Similarity scoring', time: recommendTime, enabled: recommendEnabled, setTime: setRecommendTime, setEnabled: setRecommendEnabled },
                    { id: 'enhance', label: 'Enhance', desc: 'AI TL;DR + translation', time: enhanceTime, enabled: enhanceEnabled, setTime: setEnhanceTime, setEnabled: setEnhanceEnabled }
                  ] as const).map(s => (
                    <div key={s.id} className="border-bg-500/10 bg-component-bg-lighter flex items-center justify-between rounded-xl border px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{s.label}</p>
                        <p className="text-bg-500 text-xs">{s.desc}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <TextInput
                          className="w-20"
                          placeholder="08:00"
                          value={s.time}
                          variant="plain"
                          onChange={s.setTime}
                        />
                        <Switch value={s.enabled} onChange={s.setEnabled} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  icon="tabler:device-floppy"
                  loading={fetchMutation.isPending || personalMutation.isPending}
                  onClick={() => {
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
                  }}
                >
                  Save schedules
                </Button>
              </div>
            </div>
          </Card>

          {/* === Shared Configuration === */}
          <div ref={sharedRef}>
            <WithQuery query={fetchSettingsQuery}>
              {fetchSettings => (
                <Card className="from-component-bg-lighter/50 to-component-bg space-y-6 border bg-gradient-to-br p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Shared configuration</p>
                      <h2 className="text-2xl font-semibold">Fetch sources and API keys</h2>
                    </div>
                    <div className="bg-custom-500/20 rounded-full px-3 py-1 text-xs font-medium">
                      Admin scope
                    </div>
                  </div>

                  <div className="border-bg-500/10 space-y-5 border-t pt-5">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">RSS sources</p>
                      <TextAreaInput
                        className="min-h-36"
                        placeholder="arxiv:physics+quant-ph+cond-mat,nature:nature+nphoton+nphys,science:science+sciadv"
                        value={rssSources}
                        variant="plain"
                        onChange={setRssSources}
                      />
                      <p className="text-bg-400 text-xs">
                        Format: source:cat1+cat2, source:cat1. Available: arxiv, nature, science, optica, aps.
                      </p>
                    </div>

                    <div className="grid gap-4 border-bg-500/10 border-t pt-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Nature API key</p>
                        <TextInput
                          placeholder={fetchSettings.hasNatureApiKey ? 'Already configured' : 'Springer Nature API key'}
                          value={natureApiKey}
                          variant="plain"
                          onChange={setNatureApiKey}
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Tavily API key</p>
                        <TextInput
                          placeholder={fetchSettings.hasTavilyApiKey ? 'Already configured' : 'Tavily API key'}
                          value={tavilyApiKey}
                          variant="plain"
                          onChange={setTavilyApiKey}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Abstract lookback days</p>
                        <TextInput
                          placeholder="1"
                          value={abstractLookbackDays}
                          variant="plain"
                          onChange={setAbstractLookbackDays}
                        />
                      </div>
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
                        Save shared settings
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </WithQuery>
          </div>

          {/* === Personal Configuration === */}
          <div ref={personalRef}>
            <WithQuery query={personalSettingsQuery}>
              {personalSettings => (
                <Card className="from-component-bg-lighter/50 to-component-bg space-y-6 border bg-gradient-to-br p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Personal configuration</p>
                      <h2 className="text-2xl font-semibold">Zotero and AI models</h2>
                    </div>
                    <div className="bg-custom-500/20 rounded-full px-3 py-1 text-xs font-medium">
                      User scope
                    </div>
                  </div>

                  <div className="border-bg-500/10 space-y-5 border-t pt-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Zotero user ID</p>
                        <TextInput
                          placeholder="1234567"
                          value={zoteroUserId}
                          variant="plain"
                          onChange={setZoteroUserId}
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Zotero API key</p>
                        <TextInput
                          placeholder={personalSettings.hasZoteroApiKey ? 'Already configured' : 'Zotero web API key'}
                          value={zoteroApiKey}
                          variant="plain"
                          onChange={setZoteroApiKey}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 border-bg-500/10 border-t pt-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">AI base URL</p>
                        <TextInput
                          placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                          value={aiBaseUrl}
                          variant="plain"
                          onChange={setAiBaseUrl}
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">AI API key</p>
                        <TextInput
                          placeholder={personalSettings.hasAiApiKey ? 'Already configured' : 'API key'}
                          value={aiApiKey}
                          variant="plain"
                          onChange={setAiApiKey}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 border-bg-500/10 border-t pt-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Chat model</p>
                        <TextInput
                          placeholder="qwen3-30b-a3b-instruct-2507"
                          value={aiModel}
                          variant="plain"
                          onChange={setAiModel}
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Embedding model</p>
                        <TextInput
                          placeholder="qwen3-embedding-8b-f16"
                          value={embeddingModel}
                          variant="plain"
                          onChange={setEmbeddingModel}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 border-bg-500/10 border-t pt-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Output language</p>
                        <TextInput
                          placeholder="Chinese"
                          value={outputLanguage}
                          variant="plain"
                          onChange={setOutputLanguage}
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Enhance threshold</p>
                        <TextInput
                          placeholder="3.6"
                          value={enhanceThreshold}
                          variant="plain"
                          onChange={setEnhanceThreshold}
                        />
                        <p className="text-bg-400 text-xs">Papers scoring above this get AI-enhanced</p>
                      </div>
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
                        Save personal settings
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </WithQuery>
          </div>

          {/* === Recent Executions === */}
          <div ref={executionsRef}>
            <Card className="from-component-bg-lighter/50 to-component-bg space-y-4 border bg-gradient-to-br p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Run history</p>
                  <h2 className="text-2xl font-semibold">Recent executions</h2>
                </div>
                <Button
                  icon="tabler:refresh"
                  variant="secondary"
                  onClick={() => { void runsQuery.refetch() }}
                >
                  Refresh
                </Button>
              </div>

              <WithQuery query={runsQuery}>
                {(data: PipelineRun[]) =>
                  data.length === 0 ? (
                    <div className="border-bg-500/10 text-bg-500 rounded-lg border border-dashed p-8 text-center text-sm">
                      No pipeline runs yet. Use the trigger above to start one.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-bg-500/10">
                            <th className="text-bg-500 px-4 py-2.5 text-left text-xs font-semibold tracking-[0.12em] uppercase">
                              Time
                            </th>
                            <th className="text-bg-500 px-4 py-2.5 text-left text-xs font-semibold tracking-[0.12em] uppercase">
                              Stage
                            </th>
                            <th className="text-bg-500 px-4 py-2.5 text-left text-xs font-semibold tracking-[0.12em] uppercase">
                              Status
                            </th>
                            <th className="text-bg-500 px-4 py-2.5 text-right text-xs font-semibold tracking-[0.12em] uppercase">
                              Result
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-bg-500/5">
                          {data.slice(0, 15).map(run => (
                            <tr key={run.id} className="hover:bg-component-bg-lighter/50 transition-colors">
                              <td className="px-4 py-2.5 text-sm whitespace-nowrap">
                                {dayjs(run.created).format('YY/MM-DD h:mm A')}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex items-center gap-1.5 text-sm font-medium capitalize">
                                  {run.stage}
                                  <span className="text-bg-400 text-xs font-normal">({run.scope})</span>
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <StatusBadge status={run.status} />
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <div className="inline-flex items-center gap-2 text-xs">
                                  <span className="text-emerald-500 font-medium">{run.insertedCount} in</span>
                                  <span className="text-bg-400">|</span>
                                  <span className="font-medium">{run.skippedCount} skip</span>
                                  <span className="text-bg-400">|</span>
                                  <span className="text-red-500 font-medium">{run.failedCount} fail</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              </WithQuery>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}

export default SettingsPage
