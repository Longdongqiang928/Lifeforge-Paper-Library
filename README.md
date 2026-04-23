# Lifeforge Paper Library

`Paper Library` is a custom LifeForge module for browsing, importing, recommending, and AI-enhancing research papers inside LifeForge.

It is implemented as a standalone module under `apps/longdongqiang--paper-library` and is developed in its own local Git repository, separate from the main LifeForge repository.

## Current Scope

This module currently provides:

- Paper list and detail pages
- In-place paper detail modal from the list page, with next/previous navigation across pages
- Favorites and folders
- JSON / JSONL import
- Abstract review page for manual abstract inspection and correction
- Three-stage pipeline:
  - `fetch`: fetch RSS feeds and save papers directly into PocketBase
  - `recommend`: rank papers against a Zotero library
  - `enhance`: generate `TL;DR`, `Translated Title`, and `Translated Abstract`
- Shared paper pool + per-user overlay data model
- Manual run page and automatic scheduled runs
- Settings page for RSS, Zotero, and AI configuration

## Module Structure

```text
client/
  manifest.ts                 Module routes and visible sidebar config
  src/pages/                  UI pages: Papers, Favorites, Import, Run, Settings, Review, Detail
  src/components/             Reusable UI components
  src/utils/                  API wrapper and frontend data helpers

server/
  forge.ts                    Module forge bootstrap
  index.ts                    Server route registration
  schema.ts                   PocketBase collections for this module
  routes/                     API endpoints
  utils/
    constants.ts              Module constants and defaults
    records.ts                Input normalization helpers
    papers.ts                 Paper response shaping helpers
    pipeline.ts               Fetch / recommend / enhance orchestration
    scheduler.ts              In-module scheduler

locales/
  en.json
  zh-CN.json
  ms.json
```

## Data Model

The module uses a split model:

- Shared papers:
  - `ldq_paperlib_papers`
- User-specific overlay:
  - `ldq_paperlib_user_states`
- Favorites:
  - `ldq_paperlib_folders`
  - `ldq_paperlib_favorites`
- Pipeline settings and runs:
  - `ldq_paperlib_fetch_settings`
  - `ldq_paperlib_user_settings`
  - `ldq_paperlib_runs`
- Import and caches:
  - `ldq_paperlib_import_batches`
  - `ldq_paperlib_zotero_cache`
  - `ldq_paperlib_embed_cache`

### Current Workflow State Model

The module now uses four separate state layers:

- Scheduler settings state
  - `fetch_enabled`, `recommend_enabled`, `enhance_enabled`
  - `fetch_time`, `recommend_time`, `enhance_time`
  - scheduler dedupe keys:
    - `last_fetch_schedule_key`
    - `last_recommend_schedule_key`
    - `last_enhance_schedule_key`
- Paper content readiness state
  - `papers.abstract_status`
  - values:
    - `ready`
    - `missing`
    - `error`
- Per-user stage state
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
- Run history state
  - `ldq_paperlib_runs`
  - stores execution history, counts, timestamps, and errors
  - no longer acts as the primary source of scheduler dedupe

## Pipeline Behavior

### Fetch

- Reads RSS sources from shared module settings
- Fetches today's feed content
- De-duplicates by fingerprint
- Tries to resolve missing abstracts through external services when configured
- Writes directly to `ldq_paperlib_papers`
- Marks paper abstract readiness through `abstract_status`
- Feed failures are recorded as failed feeds without stopping the whole fetch run

### Recommend

- Uses the current user's Zotero credentials
- Builds / refreshes Zotero cache in PocketBase
- Computes similarity between fetched papers and Zotero collections
- Writes scores and matched collections into `ldq_paperlib_user_states`
- Only processes papers where `abstract_status = ready`
- Marks skipped papers explicitly, for example:
  - `no_abstract`
  - `unchanged`
- Uses `recommend_input_hash` so already completed unchanged papers can be skipped cleanly

### Enhance

- Selects papers above the configured relevance threshold
- Calls the configured chat model
- Writes only:
  - `tldr`
  - `translated_title`
  - `translated_abstract`
- Only processes papers where:
  - `abstract_status = ready`
  - `recommend` data exists
  - score passes the threshold
- Uses `enhance_input_hash` so already completed unchanged papers are skipped instead of re-running the model
- Records explicit skip reasons, including:
  - `no_state_or_below_threshold`
  - `no_abstract`
  - `unchanged`

## Scheduling Rules

The scheduler is implemented inside the module server and does not require changes to the LifeForge host framework.

Current coordination rules:

- A new `fetch` run marks older running `fetch` runs as `failed`, then starts a new `fetch`
- A new `recommend` run marks older running `recommend` runs as `failed`
- If a `fetch` is running, `recommend` waits for `fetch` to finish
- A new `enhance` run marks older running `enhance` runs as `failed`
- If a `recommend` is running, `enhance` waits for `recommend` to finish
- Stale running jobs are automatically recycled after the configured timeout
- Scheduler dedupe is based on per-settings schedule keys, not on `runs`
- Clearing run history alone no longer causes the scheduler to re-trigger the same stage for the same scheduled slot

## Import Behavior

The import page supports:

- `.json`
- `.jsonl`
- file upload
- pasted raw JSON / JSONL

Imports write directly to the database. There is no JSONL-based intermediate pipeline anymore.

Import can also seed user overlay state:

- imported score / collections mark `recommend_status = completed`
- imported TL;DR / translations mark `enhance_status = completed`
- imported overlay defaults now align with the current stage-state model

Long text handling:

- text fields are truncated to `6000` characters when needed
- truncation is logged as a warning instead of failing the whole record

## Development

From the LifeForge workspace:

```bash
cd apps/longdongqiang--paper-library
bun install
```

Available scripts:

```bash
bun run types
bun run build:client
bun run build:server
```

Typical Docker-based integration flow from the LifeForge root:

```bash
bun forge db push longdongqiang--paper-library
docker compose restart server
```

If the client bundle changed, also rebuild the Docker assets:

```bash
cd apps/longdongqiang--paper-library/client
DOCKER_BUILD=true bun run vite build
```

## Notes For Git Usage

This module is intentionally versioned in its own Git repository.

Typical workflow:

```bash
cd apps/longdongqiang--paper-library
git status
git add .
git commit -m "..."
git push
```

## Known Limitations

- Shared fetch settings are not yet strongly restricted to superusers in code
- Recommend still recalculates candidate paper embeddings on each run; only Zotero-side embeddings are cached
- Enhance output still depends on model output stability
- Run detail cards show the main skip counters, but stage-state internals are richer than the current UI exposes
- The module currently assumes a single running LifeForge server instance

## Repository

GitHub:

- `git@github.com:Longdongqiang928/Lifeforge-Paper-Library.git`
