# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the PaperLibrary module in this repository.

## Module Overview

PaperLibrary (`longdongqiang--paper-library`) is a LifeForge module for browsing, importing, recommending, and AI-enhancing research papers. It is developed in its own local Git repository inside the LifeForge monorepo at `apps/longdongqiang--paper-library/`.

This module implements a **four-stage pipeline** (fetch → abstract → recommend → enhance) with a shared paper pool and per-user overlay data. Papers are fetched from academic RSS feeds (arXiv, Nature, Science, Optica, APS), have missing abstracts filled via Nature/OpenAlex/Tavily, are matched against the user's Zotero library via embeddings, and are optionally enhanced with AI-generated TL;DR and translations.

## Common Commands

```bash
# Typecheck (client)
bun run types

# Build client bundle (Module Federation, outputs to dist/)
bun run build:client

# Build client for Docker (outputs to dist-docker/, base=/api)
cd client && DOCKER_BUILD=true bun run vite build

# Build server bundle (outputs to server/dist/index.js)
bun run build:server

# Push schema changes to PocketBase (run from monorepo root)
bun forge db push longdongqiang--paper-library
docker compose restart server
```

Git workflow (this module has its own `.git`, separate from the LifeForge monorepo root):
```bash
# Always operate on the module's own git, never the monorepo root
git -C apps/longdongqiang--paper-library add -A
git -C apps/longdongqiang--paper-library commit -m "..."
git -C apps/longdongqiang--paper-library push
```

## Deployment Rules (CRITICAL)

After any code change, you MUST rebuild and restart. The module's scheduler, pipeline, and all server-side logic run inside `lifeforge-server`'s long-lived process. Source changes do not take effect until the container is restarted.

### Frontend changes (`client/src/**`, `client/manifest.ts`, `locales/**`)

```bash
cd apps/longdongqiang--paper-library
bun run build:client                    # builds dist/
cd client && DOCKER_BUILD=true bun run vite build  # builds dist-docker/
docker compose restart server
```

### Backend changes (`server/**`)

```bash
cd apps/longdongqiang--paper-library
bun run build:server
docker compose restart server
```

### Schema changes (`server/schema.ts`, `server/utils/constants.ts`)

```bash
bun forge db push longdongqiang--paper-library
docker compose restart server
```

### Why restart is mandatory

- The scheduler uses a cached superuser PocketBase connection
- Pipeline logic is loaded from the server bundle at startup
- Only restarting the container picks up new bundle code
- Past bugs: scheduler continuing to run old logic, stale PB connections causing 400 errors every tick

### How module assets are served in Docker

The module frontend is loaded via Module Federation. The chain is:

1. Vite builds with `base=/api/modules/longdongqiang--paper-library/`, so `remoteEntry.js` and chunk URLs start with `/api/modules/...`
2. Nginx proxies `/api/` to `server:3636`
3. The server's route at `/modules/:moduleName/*` serves static files from the mounted `apps/` directory

**Do NOT add nginx location blocks or apps volume mounts to the client container.** Module assets are served through the server's API route, not directly by nginx.

## Module Architecture

### Server (`server/`)

- **`index.ts`**: Entry point. Registers routes and starts the pipeline scheduler (`startPipelineScheduler()`).
- **`forge.ts`**: Creates the forge instance with `createForge(schema, MODULE_ID)`.
- **`schema.ts`**: Defines 9 PocketBase collections using `cleanSchemas(...)`. Field builders (`textField`, `jsonField`, `relationField`, etc.) are local helpers.
- **`routes/`**: API endpoints grouped by domain:
  - `papers.ts` — list, detail, filters, abstract review
  - `favorites.ts` — folders and favorites CRUD
  - `imports.ts` — JSON/JSONL import
  - `pipeline.ts` — manual trigger, run history, active runs, settings
- **`utils/pipeline.ts`**: Core orchestration (~2800 lines). Contains `runFetchStage`, `runAbstractStage`, `runRecommendStage`, `runEnhanceStage`, `triggerStages`, and scheduler helpers.
- **`utils/scheduler.ts`**: Simple `setInterval` wrapper calling `runScheduledStages(dayjs())` every `PIPELINE_TICK_MS` (60s).
- **`utils/records.ts`**: Input normalization helpers (`normalizeIncomingPaper`, `buildFingerprint`, `asStringArray`, etc.).
- **`utils/constants.ts`**: Module IDs, collection names, enums, and defaults.

### Client (`client/`)

- **`manifest.ts`**: Exports `ModuleConfig` with full routes and a reduced visible sidebar subsection (`Papers`, `Favorites`, `Settings`). `Import`, `Run`, and `Abstract Review` remain routable but are not shown in the sidebar.
- **`src/pages/`**: 7 pages — `PaperListPage`, `PaperDetailPage`, `FavoritesPage`, `ImportPage`, `RunPage`, `SettingsPage`, `AbstractReviewPage`.
- **`src/components/`**: `PaperCard`, `PaperDetailModal`, `PaperDetailContent`, `CreateFolderModal`, `MoveFavoriteModal`. The list page uses a modal detail flow rather than navigating away for normal inspection.
- **`src/utils/`**: `types.ts`, `papers.ts` (frontend data helpers), `module.ts`, `forgeAPI.ts`.
- **`vite.config.ts`**: Uses `@originjs/vite-plugin-federation` to expose `./Manifest` as `remoteEntry.js`. Build base is `${apiHost}/modules/${moduleName}/`. When `DOCKER_BUILD=true`, outputs to `dist-docker/` with `apiHost=/api`.

### Data Model

| Collection | Purpose |
|---|---|
| `ldq_paperlib_papers` | Shared paper pool (title, authors, abstract, doi, url, fingerprint, source, `abstract_status`, etc.) |
| `ldq_paperlib_user_states` | Per-user overlay (score_max, score_breakdown, matched_collections, tldr, translated_title, translated_abstract, recommend/enhance status, input hashes, last run ids, last reasons) |
| `ldq_paperlib_folders` | User favorite folders |
| `ldq_paperlib_favorites` | Paper-folder favorites (unique on user+paper) |
| `ldq_paperlib_fetch_settings` | Shared config: RSS sources, API keys (Nature, Tavily), fetch schedule, abstract schedule, scheduler dedupe keys |
| `ldq_paperlib_user_settings` | Per-user Zotero/AI config, thresholds, recommend/enhance schedules, scheduler dedupe keys |
| `ldq_paperlib_runs` | Pipeline run records (stage, status, counts, timestamps) |
| `ldq_paperlib_import_batches` | Import batch metadata |
| `ldq_paperlib_zotero_cache` | Cached Zotero items per user |
| `ldq_paperlib_embed_cache` | Cached embeddings per user+model |

### Workflow State Model

The current implementation separates state into four layers:

1. **Scheduler settings state**
   - Fetch/abstract (shared, admin): `fetch_enabled`, `fetch_time`, `abstract_enabled`, `abstract_time`, `abstract_lookback_days`, `last_fetch_schedule_key`, `last_abstract_schedule_key`
   - Recommend/enhance (per-user): `recommend_enabled`, `recommend_time`, `enhance_enabled`, `enhance_time`, `last_recommend_schedule_key`, `last_enhance_schedule_key`
2. **Paper content readiness**
   - `papers.abstract_status`
   - only valid values: `ready`, `missing`, `error`
3. **Per-user stage state**
   - `recommend_status`, `enhance_status`
   - values: `idle`, `completed`, `failed`
   - paired metadata: `recommend_input_hash`, `enhance_input_hash`, `recommend_last_run_id`, `enhance_last_run_id`, `recommend_last_reason`, `enhance_last_reason`
4. **Run history**
   - `ldq_paperlib_runs` — execution history, counts, timestamps, lock lifecycle
   - NOT the primary source of scheduler dedupe

### Pipeline Stages

**Fetch** (`runFetchStage`):
- Reads `fetch_settings.rss_sources` (comma-separated `source:cat1+cat2` format)
- Fetches RSS XML, parses items, deduplicates by `fingerprint`
- Deduplication: within-batch + against last successful fetch run's papers
- RSS abstract trust policy: only arxiv is trusted; science/aps/optica/nature RSS summaries are discarded
- Sets `abstract_status` to `ready` (arxiv with abstract) or `missing` (no abstract from RSS)
- Existing papers are skipped (no upsert/overwrite)
- **Does NOT resolve missing abstracts** — that is the Abstract stage's job
- Feed-level failures are recorded in `failedFeeds` and do not abort the whole fetch stage

**Abstract** (`runAbstractStage`):
- Queries papers with `abstract_status = 'missing'` within the lookback window
- Tries three providers in order: Nature API → OpenAlex → Tavily
- Updates `abstract_status` to `ready` on success
- Scope: global (shared), uses `fetch_settings` for API keys
- Settings (admin): `abstract_enabled`, `abstract_time`, `abstract_lookback_days` (default 1)

**Recommend** (`runRecommendStage`):
- Refreshes Zotero cache if older than 24h (`ZOTERO_CACHE_TTL_HOURS`)
- Builds collection buckets from Zotero items
- Requests embeddings for candidate papers and Zotero cache entries via OpenAI-compatible `/embeddings` endpoint
- Computes weighted cosine similarity per collection (weight decays by corpus index: `1 / (1 + log10(index + 1))`)
- Scores scaled to 0–10; writes `score_max`, `score_breakdown`, `matched_collections` to `ldq_paperlib_user_states`
- Lookback range controlled by `recommend_lookback_days` (default 7)
- Uses `abstract_status = ready` as the content gate
- No existing `user_state` is required — overlay is auto-created on write

**Enhance** (`runEnhanceStage`):
- Selects papers where `score_max >= enhance_threshold` (default 3.6)
- Calls chat model (`/chat/completions`) with a system prompt requesting JSON with `tldr`, `translated_title`, `translated_abstract`
- Uses `parseJSONResponse` with fallback regex extraction and `sanitizeJSONString` for robust parsing
- Writes results to `ldq_paperlib_user_states`
- Lookback range controlled by `enhance_lookback_days` (default 3)
- Uses `abstract_status = ready` as the content gate

### Scheduler Coordination

Implemented entirely inside the module (`pipeline.ts` + `scheduler.ts`):
- Execution order enforcement: fetch → abstract → recommend → enhance
- A new run of a stage marks older running runs of the same stage as `failed`
- Abstract waits for fetch, recommend waits for abstract, enhance waits for recommend
- Stale running jobs (> 6h, `RUN_STALE_TIMEOUT_MS`) are auto-recycled
- **Scheduler dedupe is based on schedule keys stored in settings, NOT on the `runs` table**
- `scheduler.ts` serializes ticks with a shared promise so overlapping interval ticks do not execute `runScheduledStages` concurrently
- On server restart, orphan `running` runs are reconciled

## Integration with LifeForge

### Server Registration

The module exports a default `forgeRouter(...)` from `server/index.ts`. LifeForge's server (`server/src/core/functions/modules/loadModuleRoutes.ts`) scans `apps/` at startup and loads `server/index.ts` (dev) or `server/dist/index.js` (production). The module key becomes `longdongqiang$paperLibrary` (`MODULE_ROUTE_KEY`).

### Client Registration

The client manifest (`client/manifest.ts`) exports a `ModuleConfig`. In dev mode, the client glob-imports `apps/*/client/manifest.ts` directly for hot reload. In production, it loads the module via Module Federation from `/api/modules/longdongqiang--paper-library/remoteEntry.js`.

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
- Fetch time: `08:00`, Abstract: `10:00`, Recommend: `09:00`, Enhance: `09:30`
- Abstract lookback: 1 day, Recommend lookback: 7 days, Enhance lookback: 3 days
- Abstract max length: 6000 characters (truncated with warning log)
- Embedding batch size: 32
- Fetch retry: 5 attempts with exponential backoff

## Mandatory Rules

These rules come from real production bugs. Violating them will reintroduce known failures.

### State model rules

- **`abstract_status` is the only gate.** Later stages (recommend, enhance) must check `abstract_status = ready`, never re-invent "is abstract empty?" logic.
- **`skipped` is NOT a valid long-lived stage status.** Only `idle`, `completed`, `failed` are allowed for `recommend_status` and `enhance_status`. Skip reasons go into `runs.details` only.
- **Schedule keys are the dedupe mechanism.** Do not use `runs` table as the source of truth for whether a stage has been triggered today.
- **`runs.details` holds ephemeral skip/error info.** It is not a long-lived state store.

### Pipeline rules

- **Abstract must remain an independent stage.** Do not merge it back into fetch.
- **Fetch must NOT overwrite existing papers.** Existing papers are skipped. Upsert would risk empty abstracts overwriting filled ones, `abstract_status` regression, and `fetched_at` pollution.
- **Deduplicate before processing.** In fetch, dedup before any per-paper work. Do not regress to "process first, dedup later."
- **Stage coordination order must not be broken.** fetch → abstract → recommend → enhance. Each later stage waits for the prior stage to complete.

### Deployment rules

- **Always restart `lifeforge-server` after backend changes.** The scheduler and pipeline run from the server's long-lived process.
- **Always build both `dist/` and `dist-docker/`** after frontend changes.
- **Push schema before restarting** if `schema.ts` or `constants.ts` changed.
- **Do not add nginx location blocks for module assets.** Module federation assets are served through the server's `/modules/:moduleName/*` route.

### Git rules

- **Only operate on the module's own git repo** (`apps/longdongqiang--paper-library/.git`), never the monorepo root.
- Use `git -C apps/longdongqiang--paper-library` to avoid accidentally touching the parent repo.

### When restructuring stage ownership

If you move configuration fields between `fetch_settings` and `user_settings` (or vice versa):
1. Update `schema.ts` — add fields to target collection, remove from source
2. Update `constants.ts` — move defaults between `DEFAULT_FETCH_SETTINGS` and `DEFAULT_USER_SETTINGS`
3. Update `pipeline.ts` — all internal types, view types, get/update functions
4. Update `routes/pipeline.ts` — API input schemas
5. Update `SettingsPage.tsx` — move UI between shared/personal cards
6. Handle backward compatibility for existing records with old field values

## Documentation Notes

When updating this module:

- Treat `README.md` as the user-facing operational summary.
- Treat `MAINTENANCE.zh-CN.md` as the operator-facing troubleshooting and recovery guide.
- Treat this file as the engineer-facing implementation map and mandatory rules.
- Keep the workflow-state section consistent with: `server/utils/constants.ts`, `server/schema.ts`, `server/utils/pipeline.ts`.
- If you add a new stage-state field or scheduler control field, update all three docs in the same change.
