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
import { Link } from 'shared'

import forgeAPI from '@/utils/forgeAPI'
import {
  MODULE_BASE_PATH,
  MODULE_NAMESPACE,
  MODULE_ROUTE_KEY
} from '@/utils/module'

function FieldHint({ children }: { children: string }) {
  return <p className="text-bg-500 text-sm leading-6">{children}</p>
}

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
        actionButton={
          <div className="flex items-center gap-2">
            <Button as={Link} icon="tabler:books" to={MODULE_BASE_PATH} variant="secondary">
              Back to papers
            </Button>
            <Button
              as={Link}
              icon="tabler:file-import"
              to={`${MODULE_BASE_PATH}/import`}
              variant="secondary"
            >
              Import
            </Button>
            <Button
              as={Link}
              icon="tabler:player-play"
              to={`${MODULE_BASE_PATH}/run`}
              variant="secondary"
            >
              Run
            </Button>
          </div>
        }
        icon="tabler:settings"
        namespace={MODULE_NAMESPACE}
        title="settingsPage"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <WithQuery query={fetchSettingsQuery}>
          {fetchSettings => (
            <Card className="space-y-5 overflow-hidden">
              <div className="from-component-bg-lighter to-component-bg bg-gradient-to-br p-1">
                <div className="component-bg rounded-xl p-5">
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-xl font-semibold">Shared fetch settings</h2>
                      <p className="text-bg-500 text-sm">
                        Global RSS sources and abstract lookup credentials for the whole module.
                      </p>
                    </div>
                    <div className="component-bg-lighter rounded-full px-3 py-1 text-xs font-medium">
                      Admin scope
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Card className="component-bg-lighter space-y-1 p-4">
                      <p className="text-sm font-medium">RSS source map</p>
                      <p className="text-bg-500 text-sm">
                        Comma-separated source blocks with category groups.
                      </p>
                    </Card>
                    <Card className="component-bg-lighter space-y-1 p-4">
                      <p className="text-sm font-medium">Abstract backfill</p>
                      <p className="text-bg-500 text-sm">
                        Nature and Tavily keys fill abstracts when RSS entries are sparse.
                      </p>
                    </Card>
                    <Card className="component-bg-lighter space-y-1 p-4">
                      <p className="text-sm font-medium">Daily schedule</p>
                      <p className="text-bg-500 text-sm">
                        Fetch runs once per day when enabled.
                      </p>
                    </Card>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Source definition</h3>
                <p className="text-bg-500 text-sm">
                  Keep one compact source map here. Each entry follows `source:category+category`.
                </p>
              </div>

              <TextAreaInput
                className="min-h-48"
                label="RSS sources"
                placeholder="arxiv:physics+quant-ph+cond-mat,nature:nature+nphoton+nphys,science:science+sciadv"
                value={rssSources}
                variant="plain"
                onChange={setRssSources}
              />
              <FieldHint>
                Example: `arxiv:physics+quant-ph+cond-mat,nature:nature+nphoton+nphys`.
                Separate sources with commas and categories with `+`.
              </FieldHint>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <Card className="component-bg-lighter space-y-4 p-4">
                  <TextInput
                    label="Fetch time"
                    placeholder="08:00"
                    value={fetchTime}
                    variant="plain"
                    onChange={setFetchTime}
                  />
                  <FieldHint>
                    Use 24-hour time. This is the shared daily fetch trigger, for example `08:00`.
                  </FieldHint>
                </Card>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-bg-500)]/15 p-4">
                  <div>
                    <p className="font-medium">Enable fetch scheduler</p>
                    <p className="text-bg-500 text-sm">
                      Keep this off until the source map and API keys are ready.
                    </p>
                  </div>
                  <Switch value={fetchEnabled} onChange={setFetchEnabled} />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label={`Nature API key${fetchSettings.hasNatureApiKey ? ' (configured)' : ''}`}
                    placeholder="Paste a Springer Nature API key"
                    value={natureApiKey}
                    variant="plain"
                    onChange={setNatureApiKey}
                  />
                  <FieldHint>
                    Optional. Used for DOI-based abstract recovery from Springer Nature metadata.
                  </FieldHint>
                </Card>

                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label={`Tavily API key${fetchSettings.hasTavilyApiKey ? ' (configured)' : ''}`}
                    placeholder="Paste a Tavily API key"
                    value={tavilyApiKey}
                    variant="plain"
                    onChange={setTavilyApiKey}
                  />
                  <FieldHint>
                    Optional. Used as a fallback search pass when the feed and DOI both miss.
                  </FieldHint>
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
            <Card className="space-y-5 overflow-hidden">
              <div className="from-component-bg-lighter to-component-bg bg-gradient-to-br p-1">
                <div className="component-bg rounded-xl p-5">
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-xl font-semibold">Personal pipeline settings</h2>
                      <p className="text-bg-500 text-sm">
                        Your Zotero source, AI endpoints, thresholds, and automatic jobs.
                      </p>
                    </div>
                    <div className="component-bg-lighter rounded-full px-3 py-1 text-xs font-medium">
                      User scope
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Card className="component-bg-lighter space-y-1 p-4">
                      <p className="text-sm font-medium">Zotero relevance</p>
                      <p className="text-bg-500 text-sm">
                        Recommend uses your Zotero library as the ranking reference set.
                      </p>
                    </Card>
                    <Card className="component-bg-lighter space-y-1 p-4">
                      <p className="text-sm font-medium">AI enhancement</p>
                      <p className="text-bg-500 text-sm">
                        Enhance only writes `TL;DR`, translated title, and translated abstract.
                      </p>
                    </Card>
                    <Card className="component-bg-lighter space-y-1 p-4">
                      <p className="text-sm font-medium">Two schedules</p>
                      <p className="text-bg-500 text-sm">
                        Recommend and enhance can run on their own windows and lookback ranges.
                      </p>
                    </Card>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Zotero and AI credentials</h3>
                <p className="text-bg-500 text-sm">
                  Fill the values that your ranking and enhancement steps need. Leave secrets blank to keep the current stored value.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label="Zotero user ID"
                    placeholder="1234567"
                    value={zoteroUserId}
                    variant="plain"
                    onChange={setZoteroUserId}
                  />
                  <FieldHint>
                    Use your Zotero user or group identifier. Recommend reads this library to score new papers.
                  </FieldHint>
                </Card>
                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label={`Zotero API key${personalSettings.hasZoteroApiKey ? ' (configured)' : ''}`}
                    placeholder="Paste a Zotero web API key"
                    value={zoteroApiKey}
                    variant="plain"
                    onChange={setZoteroApiKey}
                  />
                  <FieldHint>
                    Needed when your library is private or when request limits matter.
                  </FieldHint>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label="AI base URL"
                    placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                    value={aiBaseUrl}
                    variant="plain"
                    onChange={setAiBaseUrl}
                  />
                  <FieldHint>
                    OpenAI-compatible endpoint used for both embeddings and enhancement completions.
                  </FieldHint>
                </Card>
                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label={`AI API key${personalSettings.hasAiApiKey ? ' (configured)' : ''}`}
                    placeholder="Paste an API key for the AI provider"
                    value={aiApiKey}
                    variant="plain"
                    onChange={setAiApiKey}
                  />
                  <FieldHint>
                    Leave blank to keep the existing stored key. The UI never echoes saved secrets.
                  </FieldHint>
                </Card>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label="AI model"
                    placeholder="qwen3-30b-a3b-instruct-2507"
                    value={aiModel}
                    variant="plain"
                    onChange={setAiModel}
                  />
                  <FieldHint>
                    Used by the enhance stage to generate TL;DR and translations.
                  </FieldHint>
                </Card>
                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label="Embedding model"
                    placeholder="qwen3-embedding-8b-f16"
                    value={embeddingModel}
                    variant="plain"
                    onChange={setEmbeddingModel}
                  />
                  <FieldHint>
                    Used by the recommend stage when computing library similarity.
                  </FieldHint>
                </Card>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label="Output language"
                    placeholder="Chinese"
                    value={outputLanguage}
                    variant="plain"
                    onChange={setOutputLanguage}
                  />
                  <FieldHint>
                    The target language for translated title and translated abstract.
                  </FieldHint>
                </Card>
                <Card className="component-bg-lighter space-y-3 p-4">
                  <TextInput
                    label="Enhance threshold"
                    placeholder="3.6"
                    value={enhanceThreshold}
                    variant="plain"
                    onChange={setEnhanceThreshold}
                  />
                  <FieldHint>
                    Only papers at or above this relevance score enter the enhance stage.
                  </FieldHint>
                </Card>
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Automatic schedules</h3>
                <p className="text-bg-500 text-sm">
                  These two jobs work on fetched-time windows, not publication dates.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card className="component-bg-lighter space-y-4 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">Auto recommend</p>
                      <p className="text-bg-500 text-sm">
                        Score newly fetched papers against your Zotero library.
                      </p>
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
                      <FieldHint>
                        24-hour time for the daily recommend run.
                      </FieldHint>
                    </div>
                    <div className="space-y-3">
                      <TextInput
                        label="Recommend lookback days"
                        placeholder="7"
                        value={recommendLookbackDays}
                        variant="plain"
                        onChange={setRecommendLookbackDays}
                      />
                      <FieldHint>
                        Number of recently fetched days included in each recommend run.
                      </FieldHint>
                    </div>
                  </div>
                </Card>

                <Card className="component-bg-lighter space-y-4 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">Auto enhance</p>
                      <p className="text-bg-500 text-sm">
                        Generate TL;DR and translations for high-score papers.
                      </p>
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
                      <FieldHint>
                        Usually later than recommend, so only ranked papers move forward.
                      </FieldHint>
                    </div>
                    <div className="space-y-3">
                      <TextInput
                        label="Enhance lookback days"
                        placeholder="3"
                        value={enhanceLookbackDays}
                        variant="plain"
                        onChange={setEnhanceLookbackDays}
                      />
                      <FieldHint>
                        Number of recently fetched days considered for enhancement.
                      </FieldHint>
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
