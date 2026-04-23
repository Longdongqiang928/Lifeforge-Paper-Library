# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the PaperLibrary module in this repository.

## Module Overview

PaperLibrary (`longdongqiang--paper-library`) is a LifeForge module for browsing, importing, recommending, and AI-enhancing research papers. It is developed in its own local Git repository inside the LifeForge monorepo at `apps/longdongqiang--paper-library/`.

This module implements a three-stage pipeline (fetch → recommend → enhance) with a shared paper pool and per-user overlay data. Papers are fetched from academic RSS feeds (arXiv, Nature, Science, Optica, APS), matched against the user's Zotero library via embeddings, and optionally enhanced with AI-generated TL;DR and translations.

## Common Commands

```bash
# Typecheck (client)
bun run types

# Build client bundle (Module Federation, outputs to dist/ or dist-docker/)
bun run build:client

# Build server bundle (outputs to server/dist/index.js)
bun run build:server

# Integration into Docker-based LifeForge (run from monorepo root)
bun forge db push longdongqiang--paper-library
docker compose restart server
```

Git workflow (this module has its own `.git`):
```bash
git add .
git commit -m "..."
git push
```

## Module Architecture

### Server (`server/`)

- **`index.ts`**: Entry point. Registers routes and starts the pipeline scheduler (`startPipelineScheduler()`).
- **`forge.ts`**: Creates the forge instance with `createForge(schema, MODULE_ID)`.
- **`schema.ts`**: Defines 9 PocketBase collections using `cleanSchemas(...)`. Field builders (`textField`, `jsonField`, `relationField`, etc.) are local helpers.
- **`routes/`**: API endpoints grouped by domain:
  - `papers.ts` — list, detail, filters, abstract review
  - `favorites.ts` — folders and favorites CRUD
  - `imports.ts` — JSON/JSONL import
  - `pipeline.ts` — manual trigger, run history, active runs
- **`utils/pipeline.ts`**: Core orchestration (~2100 lines). Contains `runFetchStage`, `runRecommendStage`, `runEnhanceStage`, `triggerStages`, and scheduler helpers.
- **`utils/scheduler.ts`**: Simple `setInterval` wrapper calling `runScheduledStages(dayjs())` every `PIPELINE_TICK_MS` (60s).
- **`utils/records.ts`**: Input normalization helpers (`normalizeIncomingPaper`, `buildFingerprint`, `asStringArray`, etc.).
- **`utils/constants.ts`**: Module IDs, collection names, enums, and defaults.

### Client (`client/`)

- **`manifest.ts`**: Exports `ModuleConfig` with full routes and a reduced visible sidebar subsection (`Papers`, `Favorites`, `Settings`). `Import`, `Run`, and `Abstract Review` remain routable but are not shown in the sidebar.
- **`src/pages/`**: 7 pages — `PaperListPage`, `PaperDetailPage`, `FavoritesPage`, `ImportPage`, `RunPage`, `SettingsPage`, `AbstractReviewPage`.
- **`src/components/`**: `PaperCard`, `PaperDetailModal`, `PaperDetailContent`, `CreateFolderModal`, `MoveFavoriteModal`. The list page uses a modal detail flow rather than navigating away for normal inspection.
- **`src/utils/`**: `types.ts`, `papers.ts` (frontend data helpers), `module.ts`, `forgeAPI.ts`.
- **`vite.config.ts`**: Uses `@originjs/vite-plugin-federation` to expose `./Manifest` as `remoteEntry.js`. Build base is `${apiHost}/modules/${moduleName}/`.

### Data Model

| Collection | Purpose |
|---|---|
| `ldq_paperlib_papers` | Shared paper pool (title, authors, abstract, doi, url, fingerprint, source, `abstract_status`, etc.) |
| `ldq_paperlib_user_states` | Per-user overlay (score_max, score_breakdown, matched_collections, tldr, translated_title, translated_abstract, recommend/enhance status, input hashes, last run ids, last reasons) |
| `ldq_paperlib_folders` | User favorite folders |
| `ldq_paperlib_favorites` | Paper-folder favorites (unique on user+paper) |
| `ldq_paperlib_fetch_settings` | Shared RSS config, API keys (Nature, Tavily), fetch schedule, scheduler dedupe key |
| `ldq_paperlib_user_settings` | Per-user Zotero/AI config, thresholds, recommend/enhance schedules, scheduler dedupe keys |
| `ldq_paperlib_runs` | Pipeline run records (stage, status, counts, timestamps) |
| `ldq_paperlib_import_batches` | Import batch metadata |
| `ldq_paperlib_zotero_cache` | Cached Zotero items per user |
| `ldq_paperlib_embed_cache` | Cached embeddings per user+model |

### Workflow State Model

The current implementation separates state into four layers:

1. **Scheduler settings state**
   - `fetch_enabled`, `recommend_enabled`, `enhance_enabled`
   - `fetch_time`, `recommend_time`, `enhance_time`
   - `last_fetch_schedule_key`, `last_recommend_schedule_key`, `last_enhance_schedule_key`
2. **Paper content readiness**
   - `papers.abstract_status`
   - only valid values:
     - `ready`
     - `missing`
     - `error`
3. **Per-user stage state**
   - `recommend_status`, `enhance_status`
   - values:
     - `idle`
     - `running`
     - `skipped`
     - `completed`
     - `failed`
   - paired metadata:
     - `recommend_input_hash`, `enhance_input_hash`
     - `recommend_last_run_id`, `enhance_last_run_id`
     - `recommend_last_reason`, `enhance_last_reason`
4. **Run history**
   - `ldq_paperlib_runs`
   - execution history, counts, timestamps, lock lifecycle
   - no longer the primary source of scheduler dedupe

### Pipeline Stages

**Fetch** (`runFetchStage`):
- Reads `fetch_settings.rss_sources` (comma-separated `source:cat1+cat2` format)
- Fetches RSS XML, parses items, deduplicates by `fingerprint`
- Resolves missing abstracts: first Nature API (if `nature_api_key` configured), then Tavily API (if `tavily_api_key` configured)
- Source-specific abstract extraction regexes for Science, APS, Optica
- Writes/updates `ldq_paperlib_papers`
- Sets `abstract_status` to:
  - `ready` when a usable abstract exists
  - `missing` when abstract resolution finishes without content
  - `error` when abstract resolution itself throws
- Feed-level failures are recorded in `failedFeeds` and do not abort the whole fetch stage

**Recommend** (`runRecommendStage`):
- Refreshes Zotero cache if older than 24h (`ZOTERO_CACHE_TTL_HOURS`)
- Builds collection buckets from Zotero items
- Requests embeddings for candidate papers and Zotero cache entries via OpenAI-compatible `/embeddings` endpoint
- Computes weighted cosine similarity per collection (weight decays by corpus index: `1 / (1 + log10(index + 1))`)
- Scores scaled to 0–10; writes `score_max`, `score_breakdown`, `matched_collections` to `ldq_paperlib_user_states`
- Lookback range controlled by `recommend_lookback_days` (default 7)
- Uses `abstract_status = ready` as the content gate
- Persists:
  - `recommend_status`
  - `recommend_input_hash`
  - `recommend_last_run_id`
  - `recommend_last_reason`
- Explicit skip reasons currently include:
  - `no_abstract`
  - `unchanged`

**Enhance** (`runEnhanceStage`):
- Selects papers where `score_max >= enhance_threshold` (default 3.6)
- Calls chat model (`/chat/completions`) with a system prompt requesting JSON with `tldr`, `translated_title`, `translated_abstract`
- Uses `parseJSONResponse` with fallback regex extraction and `sanitizeJSONString` for robust parsing
- Writes results to `ldq_paperlib_user_states`
- Lookback range controlled by `enhance_lookback_days` (default 3)
- Uses `abstract_status = ready` as the content gate
- Persists:
  - `enhance_status`
  - `enhance_input_hash`
  - `enhance_last_run_id`
  - `enhance_last_reason`
- Explicit skip reasons currently include:
  - `no_state_or_below_threshold`
  - `no_abstract`
  - `unchanged`

### Scheduler Coordination

Implemented entirely inside the module (`pipeline.ts` + `scheduler.ts`):
- A new `fetch` run marks older running `fetch` runs as `failed`
- A new `recommend` run marks older running `recommend` runs as `failed`, then waits for any running `fetch`
- A new `enhance` run marks older running `enhance` runs as `failed`, then waits for any running `recommend`
- Stale running jobs (> 6h, `RUN_STALE_TIMEOUT_MS`) are auto-recycled
- Scheduler dedupe is based on schedule keys stored in settings, not on the `runs` table
- `scheduler.ts` serializes ticks with a shared promise so overlapping interval ticks do not execute `runScheduledStages` concurrently

## Integration with LifeForge

### Server Registration

The module exports a default `forgeRouter(...)` from `server/index.ts`. LifeForge's server (`server/src/core/functions/modules/loadModuleRoutes.ts`) scans `apps/` at startup and loads `server/index.ts` (dev) or `server/dist/index.js` (production). The module key becomes `longdongqiang$paperLibrary` (`MODULE_ROUTE_KEY`).

### Client Registration

The client manifest (`client/manifest.ts`) exports a `ModuleConfig`. In dev mode, the client glob-imports `apps/*/client/manifest.ts` directly for hot reload. In production, it loads the module via Module Federation from `/modules/longdongqiang--paper-library/remoteEntry.js`.

### API Pattern

Server endpoints are defined with the `forge` DSL from `@lifeforge/server-utils`:
```ts
const endpoint = forge
  .query()
  .input({ query: z.object({ q: z.string() }) })
  .callback(async ({ query, pb }) => { ... })
```

Client calls use the typed proxy:
```ts
forgeAPI.longdongqiang$paperLibrary.papers.list.input({ ... }).query()
```

## Important Defaults

- RSS sources: `arxiv:physics+quant-ph+cond-mat+nlin,nature:nature+nphoton+ncomms+nphys+natrevphys+lsa+natmachintell,science:science+sciadv,optica:optica,aps:prl+prx+rmp`
- AI model: `qwen3-30b-a3b-instruct-2507`
- Embedding model: `qwen3-embedding-8b-f16`
- Output language: `Chinese`
- Fetch time: `08:00`, Recommend: `09:00`, Enhance: `09:30`
- Abstract max length: 6000 characters (truncated with warning log)
- Embedding batch size: 32
- Fetch retry: 5 attempts with exponential backoff

## Current Documentation Notes

When updating this module:

- Treat `README.md` as the user-facing operational summary.
- Treat this file as the engineer-facing implementation map.
- Keep the workflow-state section in both files consistent with:
  - `server/utils/constants.ts`
  - `server/schema.ts`
  - `server/utils/pipeline.ts`
- If you add a new stage-state field or scheduler control field, update both docs in the same change.
