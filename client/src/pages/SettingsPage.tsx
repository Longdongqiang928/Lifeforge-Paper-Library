import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  ModuleHeader,
  Switch,
  TextAreaInput,
  TextInput,
  WithQuery
} from 'lifeforge-ui'
import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'

import ModuleSubnav from '@/components/ModuleSubnav'
import forgeAPI from '@/utils/forgeAPI'
import {
  MODULE_NAMESPACE,
  MODULE_ROUTE_KEY
} from '@/utils/module'



function SettingsPage() {
  const queryClient = useQueryClient()

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

  const fetchMutation = useMutation(
    forgeAPI.pipeline.settings.fetch.update.mutationOptions({
      onSuccess: () => {
        toast.success('Fetch settings saved')
        setNatureApiKey('')
        setTavilyApiKey('')
        queryClient.invalidateQueries({
          queryKey: [MODULE_ROUTE_KEY, 'pipeline', 'settings', 'fetch']
        })
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
        queryClient.invalidateQueries({
          queryKey: [MODULE_ROUTE_KEY, 'pipeline', 'settings', 'personal']
        })
      },
      onError: error => {
        toast.error(error instanceof Error ? error.message : 'Failed to save personal settings')
      }
    })
  )

  return (
    <>
      <ModuleHeader
        icon="tabler:settings"
        namespace={MODULE_NAMESPACE}
        title="settingsPage"
      />
      <ModuleSubnav />

      <div className="space-y-6">
        <WithQuery query={fetchSettingsQuery}>
          {fetchSettings => (
            <Card className="border-bg-500/10 space-y-5 overflow-hidden border bg-component-bg/60 backdrop-blur-md shadow-sm transition-shadow hover:shadow-md">
              <div className="from-component-bg-lighter to-component-bg bg-gradient-to-br p-1">
                <div className="component-bg rounded-xl p-5">
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Shared configuration</p>
                      <h2 className="text-2xl font-semibold">Fetch and abstract</h2>
                      
                    </div>
                    <div className="component-bg-lighter rounded-full px-3 py-1 text-xs font-medium">
                      Admin scope
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Card className="component-bg-lighter space-y-1 p-4">
                      <p className="text-sm font-medium">RSS source map</p>
                      
                    </Card>
                    <Card className="component-bg-lighter space-y-1 p-4">
                      <p className="text-sm font-medium">Abstract backfill</p>
                      
                    </Card>
                    <Card className="component-bg-lighter space-y-1 p-4">
                      <p className="text-sm font-medium">Daily schedule</p>
                      
                    </Card>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Source definition</h3>
                
              </div>

              <TextAreaInput
                className="min-h-48"
                label="RSS sources"
                placeholder="arxiv:physics+quant-ph+cond-mat,nature:nature+nphoton+nphys,science:science+sciadv"
                value={rssSources}
                variant="plain"
                onChange={setRssSources}
              />
              <Card className="component-bg-lighter space-y-4 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">Enable fetch scheduler</p>
                  </div>
                  <Switch value={fetchEnabled} onChange={setFetchEnabled} />
                </div>
                <TextInput
                  label="Fetch time"
                  placeholder="08:00"
                  value={fetchTime}
                  variant="plain"
                  onChange={setFetchTime}
                />
              </Card>

              <Card className="component-bg-lighter space-y-4 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">Auto abstract</p>
                  </div>
                  <Switch value={abstractEnabled} onChange={setAbstractEnabled} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextInput
                    label="Abstract time"
                    placeholder="10:00"
                    value={abstractTime}
                    variant="plain"
                    onChange={setAbstractTime}
                  />
                  <TextInput
                    label="Abstract lookback days"
                    placeholder="1"
                    value={abstractLookbackDays}
                    variant="plain"
                    onChange={setAbstractLookbackDays}
                  />
                </div>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label={`Nature API key${fetchSettings.hasNatureApiKey ? ' (configured)' : ''}`}
                    placeholder="Paste a Springer Nature API key"
                    value={natureApiKey}
                    variant="plain"
                    onChange={setNatureApiKey}
                  />
                  </Card>

                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label={`Tavily API key${fetchSettings.hasTavilyApiKey ? ' (configured)' : ''}`}
                    placeholder="Paste a Tavily API key"
                    value={tavilyApiKey}
                    variant="plain"
                    onChange={setTavilyApiKey}
                  />
                  </Card>
              </div>

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
                Save fetch settings
              </Button>
            </Card>
          )}
        </WithQuery>

        <WithQuery query={personalSettingsQuery}>
          {personalSettings => (
            <Card className="border-bg-500/10 space-y-5 overflow-hidden border bg-component-bg/60 backdrop-blur-md shadow-sm transition-shadow hover:shadow-md">
              <div className="from-component-bg-lighter to-component-bg bg-gradient-to-br p-1">
                <div className="component-bg rounded-xl p-5">
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-bg-500 text-xs font-semibold tracking-[0.18em] uppercase">Personal configuration</p>
                      <h2 className="text-2xl font-semibold">Zotero, models, and schedules</h2>
                      
                    </div>
                    <div className="component-bg-lighter rounded-full px-3 py-1 text-xs font-medium">
                      User scope
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Card className="component-bg-lighter space-y-1 p-4">
                      <p className="text-sm font-medium">Zotero relevance</p>
                      
                    </Card>
                    <Card className="component-bg-lighter space-y-1 p-4">
                      <p className="text-sm font-medium">AI enhancement</p>
                      
                    </Card>
                    <Card className="component-bg-lighter space-y-1 p-4">
                      <p className="text-sm font-medium">Personal schedules</p>
                      
                    </Card>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Zotero and AI credentials</h3>
                
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label="Zotero user ID"
                    placeholder="1234567"
                    value={zoteroUserId}
                    variant="plain"
                    onChange={setZoteroUserId}
                  />
                  </Card>
                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label={`Zotero API key${personalSettings.hasZoteroApiKey ? ' (configured)' : ''}`}
                    placeholder="Paste a Zotero web API key"
                    value={zoteroApiKey}
                    variant="plain"
                    onChange={setZoteroApiKey}
                  />
                  </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label="AI base URL"
                    placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                    value={aiBaseUrl}
                    variant="plain"
                    onChange={setAiBaseUrl}
                  />
                  </Card>
                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label={`AI API key${personalSettings.hasAiApiKey ? ' (configured)' : ''}`}
                    placeholder="Paste an API key for the AI provider"
                    value={aiApiKey}
                    variant="plain"
                    onChange={setAiApiKey}
                  />
                  </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label="AI model"
                    placeholder="qwen3-30b-a3b-instruct-2507"
                    value={aiModel}
                    variant="plain"
                    onChange={setAiModel}
                  />
                  </Card>
                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label="Embedding model"
                    placeholder="qwen3-embedding-8b-f16"
                    value={embeddingModel}
                    variant="plain"
                    onChange={setEmbeddingModel}
                  />
                  </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label="Output language"
                    placeholder="Chinese"
                    value={outputLanguage}
                    variant="plain"
                    onChange={setOutputLanguage}
                  />
                  </Card>
                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label="Enhance threshold"
                    placeholder="3.6"
                    value={enhanceThreshold}
                    variant="plain"
                    onChange={setEnhanceThreshold}
                  />
                  </Card>
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Automatic schedules</h3>
                
              </div>

              <div className="space-y-4">
                <Card className="component-bg-lighter space-y-4 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">Auto recommend</p>
                      
                    </div>
                    <Switch value={recommendEnabled} onChange={setRecommendEnabled} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-3">
                      <TextInput
                        label="Recommend time"
                        placeholder="09:00"
                        value={recommendTime}
                        variant="plain"
                        onChange={setRecommendTime}
                      />
                      </div>
                    <div className="space-y-3">
                      <TextInput
                        label="Recommend lookback days"
                        placeholder="7"
                        value={recommendLookbackDays}
                        variant="plain"
                        onChange={setRecommendLookbackDays}
                      />
                      </div>
                  </div>
                </Card>

                <Card className="component-bg-lighter space-y-4 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">Auto enhance</p>
                      
                    </div>
                    <Switch value={enhanceEnabled} onChange={setEnhanceEnabled} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-3">
                      <TextInput
                        label="Enhance time"
                        placeholder="09:30"
                        value={enhanceTime}
                        variant="plain"
                        onChange={setEnhanceTime}
                      />
                      </div>
                    <div className="space-y-3">
                      <TextInput
                        label="Enhance lookback days"
                        placeholder="3"
                        value={enhanceLookbackDays}
                        variant="plain"
                        onChange={setEnhanceLookbackDays}
                      />
                      </div>
                  </div>
                </Card>
              </div>

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
            </Card>
          )}
        </WithQuery>
      </div>
    </>
  )
}

export default SettingsPage
