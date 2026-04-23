import { cleanSchemas } from '@lifeforge/server-utils'
import z from 'zod'

import {
  ABSTRACT_STATUS_IDS,
  COLLECTION_NAMES,
  PROCESS_STATUS_IDS,
  RUN_SCOPE_IDS,
  RUN_STAGE_IDS,
  RUN_STATUS_IDS,
  RUN_TRIGGER_IDS
} from './utils/constants'

const AUTH_RULE = '@request.auth.id != ""'

function idField() {
  return {
    autogeneratePattern: '[a-z0-9]{15}',
    hidden: false,
    max: 15,
    min: 15,
    name: 'id',
    pattern: '^[a-z0-9]+$',
    presentable: false,
    primaryKey: true,
    required: true,
    system: true,
    type: 'text'
  }
}

function textField(name: string, required = false, max = 0) {
  return {
    autogeneratePattern: '',
    hidden: false,
    max,
    min: 0,
    name,
    pattern: '',
    presentable: false,
    primaryKey: false,
    required,
    system: false,
    type: 'text'
  }
}

function relationField(
  name: string,
  collectionId: string,
  required = false,
  cascadeDelete = false
) {
  return {
    cascadeDelete,
    collectionId,
    hidden: false,
    maxSelect: 1,
    minSelect: 0,
    name,
    presentable: false,
    required,
    system: false,
    type: 'relation'
  }
}

function jsonField(name: string) {
  return {
    hidden: false,
    maxSize: 0,
    name,
    presentable: false,
    required: false,
    system: false,
    type: 'json'
  }
}

function numberField(name: string, required = false) {
  return {
    hidden: false,
    max: null,
    min: null,
    name,
    onlyInt: false,
    presentable: false,
    required,
    system: false,
    type: 'number'
  }
}

function boolField(name: string) {
  return {
    hidden: false,
    name,
    presentable: false,
    required: false,
    system: false,
    type: 'bool'
  }
}

function dateField(name: string) {
  return {
    hidden: false,
    max: '',
    min: '',
    name,
    presentable: false,
    required: false,
    system: false,
    type: 'date'
  }
}

function urlField(name: string) {
  return {
    exceptDomains: null,
    hidden: false,
    name,
    onlyDomains: null,
    presentable: false,
    required: false,
    system: false,
    type: 'url'
  }
}

function selectField(name: string, values: readonly string[], required = true) {
  return {
    hidden: false,
    maxSelect: 1,
    name,
    presentable: false,
    required,
    system: false,
    type: 'select',
    values: [...values]
  }
}

function autoDateField(name: 'created' | 'updated', onUpdate: boolean) {
  return {
    hidden: false,
    name,
    onCreate: true,
    onUpdate,
    presentable: false,
    system: false,
    type: 'autodate'
  }
}

export const schemas = {
  papers: {
    schema: z.object({
      external_id: z.string().optional(),
      fingerprint: z.string(),
      title: z.string(),
      authors: z.any(),
      abstract: z.string().optional(),
      journal: z.string().optional(),
      source: z.string().optional(),
      published_at: z.string().optional(),
      doi: z.string().optional(),
      url: z.string().optional(),
      pdf_url: z.string().optional(),
      keywords: z.any(),
      raw_payload: z.any(),
      fetch_run_id: z.string().optional(),
      fetched_at: z.string().optional(),
      last_seen_at: z.string().optional(),
      abstract_status: z.enum(ABSTRACT_STATUS_IDS),
      created: z.string(),
      updated: z.string()
    }),
    raw: {
      listRule: AUTH_RULE,
      viewRule: AUTH_RULE,
      createRule: AUTH_RULE,
      updateRule: AUTH_RULE,
      deleteRule: AUTH_RULE,
      name: COLLECTION_NAMES.papers,
      type: 'base',
      fields: [
        idField(),
        textField('external_id'),
        textField('fingerprint', true),
        textField('title', true),
        jsonField('authors'),
        textField('abstract', false, 6000),
        textField('journal'),
        textField('source'),
        dateField('published_at'),
        textField('doi'),
        urlField('url'),
        urlField('pdf_url'),
        jsonField('keywords'),
        jsonField('raw_payload'),
        textField('fetch_run_id'),
        dateField('fetched_at'),
        dateField('last_seen_at'),
        selectField('abstract_status', ABSTRACT_STATUS_IDS),
        autoDateField('created', false),
        autoDateField('updated', true)
      ],
      indexes: [
        `CREATE UNIQUE INDEX \`idx_ldq_paperlib_fingerprint\` ON \`${COLLECTION_NAMES.papers}\` (\`fingerprint\`)`
      ],
      system: false
    }
  },
  favorite_folders: {
    schema: z.object({
      user: z.string(),
      name: z.string(),
      sort_order: z.number(),
      created: z.string(),
      updated: z.string()
    }),
    raw: {
      listRule: AUTH_RULE,
      viewRule: AUTH_RULE,
      createRule: AUTH_RULE,
      updateRule: AUTH_RULE,
      deleteRule: AUTH_RULE,
      name: COLLECTION_NAMES.favoriteFolders,
      type: 'base',
      fields: [
        idField(),
        relationField('user', 'users', true, true),
        textField('name', true),
        numberField('sort_order'),
        autoDateField('created', false),
        autoDateField('updated', true)
      ],
      indexes: [
        `CREATE UNIQUE INDEX \`idx_ldq_paperlib_folders\` ON \`${COLLECTION_NAMES.favoriteFolders}\` (\`user\`, \`name\`)`
      ],
      system: false
    }
  },
  paper_favorites: {
    schema: z.object({
      user: z.string(),
      paper: z.string(),
      folder: z.string(),
      created: z.string(),
      updated: z.string()
    }),
    raw: {
      listRule: AUTH_RULE,
      viewRule: AUTH_RULE,
      createRule: AUTH_RULE,
      updateRule: AUTH_RULE,
      deleteRule: AUTH_RULE,
      name: COLLECTION_NAMES.paperFavorites,
      type: 'base',
      fields: [
        idField(),
        relationField('user', 'users', true, true),
        relationField('paper', COLLECTION_NAMES.papers, true, true),
        relationField('folder', COLLECTION_NAMES.favoriteFolders, true, true),
        autoDateField('created', false),
        autoDateField('updated', true)
      ],
      indexes: [
        `CREATE UNIQUE INDEX \`idx_ldq_paperlib_favorites\` ON \`${COLLECTION_NAMES.paperFavorites}\` (\`user\`, \`paper\`)`
      ],
      system: false
    }
  },
  user_paper_states: {
    schema: z.object({
      user: z.string(),
      paper: z.string(),
      score_max: z.number().optional(),
      score_breakdown: z.any(),
      matched_collections: z.any(),
      tldr: z.string().optional(),
      translated_title: z.string().optional(),
      translated_abstract: z.string().optional(),
      recommend_input_hash: z.string().optional(),
      enhance_input_hash: z.string().optional(),
      recommend_status: z.enum(PROCESS_STATUS_IDS),
      enhance_status: z.enum(PROCESS_STATUS_IDS),
      recommend_last_run_id: z.string().optional(),
      enhance_last_run_id: z.string().optional(),
      recommend_last_reason: z.string().optional(),
      enhance_last_reason: z.string().optional(),
      recommended_at: z.string().optional(),
      enhanced_at: z.string().optional(),
      created: z.string(),
      updated: z.string()
    }),
    raw: {
      listRule: AUTH_RULE,
      viewRule: AUTH_RULE,
      createRule: AUTH_RULE,
      updateRule: AUTH_RULE,
      deleteRule: AUTH_RULE,
      name: COLLECTION_NAMES.userPaperStates,
      type: 'base',
      fields: [
        idField(),
        relationField('user', 'users', true, true),
        relationField('paper', COLLECTION_NAMES.papers, true, true),
        numberField('score_max'),
        jsonField('score_breakdown'),
        jsonField('matched_collections'),
        textField('tldr', false, 6000),
        textField('translated_title', false, 6000),
        textField('translated_abstract', false, 6000),
        textField('recommend_input_hash'),
        textField('enhance_input_hash'),
        selectField('recommend_status', PROCESS_STATUS_IDS),
        selectField('enhance_status', PROCESS_STATUS_IDS),
        textField('recommend_last_run_id'),
        textField('enhance_last_run_id'),
        textField('recommend_last_reason'),
        textField('enhance_last_reason'),
        dateField('recommended_at'),
        dateField('enhanced_at'),
        autoDateField('created', false),
        autoDateField('updated', true)
      ],
      indexes: [
        `CREATE UNIQUE INDEX \`idx_ldq_paperlib_user_paper\` ON \`${COLLECTION_NAMES.userPaperStates}\` (\`user\`, \`paper\`)`
      ],
      system: false
    }
  },
  fetch_settings: {
    schema: z.object({
      config_key: z.string(),
      rss_sources: z.string(),
      nature_api_key: z.string().optional(),
      tavily_api_key: z.string().optional(),
      fetch_enabled: z.boolean(),
      fetch_time: z.string(),
      last_fetch_schedule_key: z.string().optional(),
      last_updated_by: z.string().optional(),
      created: z.string(),
      updated: z.string()
    }),
    raw: {
      listRule: AUTH_RULE,
      viewRule: AUTH_RULE,
      createRule: AUTH_RULE,
      updateRule: AUTH_RULE,
      deleteRule: AUTH_RULE,
      name: COLLECTION_NAMES.fetchSettings,
      type: 'base',
      fields: [
        idField(),
        textField('config_key', true),
        textField('rss_sources', true),
        textField('nature_api_key'),
        textField('tavily_api_key'),
        boolField('fetch_enabled'),
        textField('fetch_time', true),
        textField('last_fetch_schedule_key'),
        relationField('last_updated_by', 'users'),
        autoDateField('created', false),
        autoDateField('updated', true)
      ],
      indexes: [
        `CREATE UNIQUE INDEX \`idx_ldq_paperlib_fetch_key\` ON \`${COLLECTION_NAMES.fetchSettings}\` (\`config_key\`)`
      ],
      system: false
    }
  },
  user_settings: {
    schema: z.object({
      user: z.string(),
      zotero_user_id: z.string().optional(),
      zotero_api_key: z.string().optional(),
      ai_base_url: z.string().optional(),
      ai_api_key: z.string().optional(),
      ai_model: z.string().optional(),
      embedding_model: z.string().optional(),
      output_language: z.string().optional(),
      enhance_threshold: z.number().optional(),
      recommend_enabled: z.boolean(),
      recommend_time: z.string(),
      enhance_enabled: z.boolean(),
      enhance_time: z.string(),
      last_recommend_schedule_key: z.string().optional(),
      last_enhance_schedule_key: z.string().optional(),
      recommend_lookback_days: z.number(),
      enhance_lookback_days: z.number(),
      created: z.string(),
      updated: z.string()
    }),
    raw: {
      listRule: AUTH_RULE,
      viewRule: AUTH_RULE,
      createRule: AUTH_RULE,
      updateRule: AUTH_RULE,
      deleteRule: AUTH_RULE,
      name: COLLECTION_NAMES.userSettings,
      type: 'base',
      fields: [
        idField(),
        relationField('user', 'users', true, true),
        textField('zotero_user_id'),
        textField('zotero_api_key'),
        textField('ai_base_url'),
        textField('ai_api_key'),
        textField('ai_model'),
        textField('embedding_model'),
        textField('output_language'),
        numberField('enhance_threshold'),
        boolField('recommend_enabled'),
        textField('recommend_time', true),
        boolField('enhance_enabled'),
        textField('enhance_time', true),
        textField('last_recommend_schedule_key'),
        textField('last_enhance_schedule_key'),
        numberField('recommend_lookback_days', true),
        numberField('enhance_lookback_days', true),
        autoDateField('created', false),
        autoDateField('updated', true)
      ],
      indexes: [
        `CREATE UNIQUE INDEX \`idx_ldq_paperlib_user_settings\` ON \`${COLLECTION_NAMES.userSettings}\` (\`user\`)`
      ],
      system: false
    }
  },
  pipeline_runs: {
    schema: z.object({
      scope: z.enum(RUN_SCOPE_IDS),
      stage: z.enum(RUN_STAGE_IDS),
      triggered_by: z.enum(RUN_TRIGGER_IDS),
      user: z.string().optional(),
      status: z.enum(RUN_STATUS_IDS),
      lock_key: z.string().optional(),
      range_start: z.string().optional(),
      range_end: z.string().optional(),
      started_at: z.string().optional(),
      finished_at: z.string().optional(),
      processed_total: z.number().optional(),
      inserted_count: z.number().optional(),
      updated_count: z.number().optional(),
      skipped_count: z.number().optional(),
      failed_count: z.number().optional(),
      error_summary: z.string().optional(),
      details: z.any(),
      created: z.string(),
      updated: z.string()
    }),
    raw: {
      listRule: AUTH_RULE,
      viewRule: AUTH_RULE,
      createRule: AUTH_RULE,
      updateRule: AUTH_RULE,
      deleteRule: AUTH_RULE,
      name: COLLECTION_NAMES.pipelineRuns,
      type: 'base',
      fields: [
        idField(),
        selectField('scope', RUN_SCOPE_IDS),
        selectField('stage', RUN_STAGE_IDS),
        selectField('triggered_by', RUN_TRIGGER_IDS),
        relationField('user', 'users'),
        selectField('status', RUN_STATUS_IDS),
        textField('lock_key'),
        dateField('range_start'),
        dateField('range_end'),
        dateField('started_at'),
        dateField('finished_at'),
        numberField('processed_total'),
        numberField('inserted_count'),
        numberField('updated_count'),
        numberField('skipped_count'),
        numberField('failed_count'),
        textField('error_summary'),
        jsonField('details'),
        autoDateField('created', false),
        autoDateField('updated', true)
      ],
      indexes: [],
      system: false
    }
  },
  import_batches: {
    schema: z.object({
      user: z.string(),
      type: z.string(),
      source: z.string().optional(),
      filename: z.string().optional(),
      status: z.string(),
      total: z.number(),
      inserted: z.number(),
      updated_count: z.number(),
      skipped: z.number(),
      failed: z.number(),
      error_log: z.string().optional(),
      created: z.string(),
      updated: z.string()
    }),
    raw: {
      listRule: AUTH_RULE,
      viewRule: AUTH_RULE,
      createRule: AUTH_RULE,
      updateRule: AUTH_RULE,
      deleteRule: AUTH_RULE,
      name: COLLECTION_NAMES.importBatches,
      type: 'base',
      fields: [
        idField(),
        relationField('user', 'users', true, true),
        textField('type', true),
        textField('source'),
        textField('filename'),
        textField('status', true),
        numberField('total'),
        numberField('inserted'),
        numberField('updated_count'),
        numberField('skipped'),
        numberField('failed'),
        textField('error_log'),
        autoDateField('created', false),
        autoDateField('updated', true)
      ],
      indexes: [],
      system: false
    }
  },
  zotero_cache_entries: {
    schema: z.object({
      user: z.string(),
      item_key: z.string(),
      title: z.string().optional(),
      abstract: z.string().optional(),
      collections: z.any(),
      raw_payload: z.any(),
      created: z.string(),
      updated: z.string()
    }),
    raw: {
      listRule: AUTH_RULE,
      viewRule: AUTH_RULE,
      createRule: AUTH_RULE,
      updateRule: AUTH_RULE,
      deleteRule: AUTH_RULE,
      name: COLLECTION_NAMES.zoteroCacheEntries,
      type: 'base',
      fields: [
        idField(),
        relationField('user', 'users', true, true),
        textField('item_key', true),
        textField('title'),
        textField('abstract'),
        jsonField('collections'),
        jsonField('raw_payload'),
        autoDateField('created', false),
        autoDateField('updated', true)
      ],
      indexes: [
        `CREATE UNIQUE INDEX \`idx_ldq_paperlib_zotero_cache\` ON \`${COLLECTION_NAMES.zoteroCacheEntries}\` (\`user\`, \`item_key\`)`
      ],
      system: false
    }
  },
  zotero_embedding_cache: {
    schema: z.object({
      user: z.string(),
      model: z.string(),
      cache_key: z.string(),
      payload_hash: z.string(),
      collection_key: z.string().optional(),
      embeddings: z.any(),
      created: z.string(),
      updated: z.string()
    }),
    raw: {
      listRule: AUTH_RULE,
      viewRule: AUTH_RULE,
      createRule: AUTH_RULE,
      updateRule: AUTH_RULE,
      deleteRule: AUTH_RULE,
      name: COLLECTION_NAMES.zoteroEmbeddingCache,
      type: 'base',
      fields: [
        idField(),
        relationField('user', 'users', true, true),
        textField('model', true),
        textField('cache_key', true),
        textField('payload_hash', true),
        textField('collection_key'),
        jsonField('embeddings'),
        autoDateField('created', false),
        autoDateField('updated', true)
      ],
      indexes: [
        `CREATE UNIQUE INDEX \`idx_ldq_paperlib_embedding_cache\` ON \`${COLLECTION_NAMES.zoteroEmbeddingCache}\` (\`user\`, \`model\`, \`cache_key\`)`
      ],
      system: false
    }
  }
}

export default cleanSchemas(schemas)
