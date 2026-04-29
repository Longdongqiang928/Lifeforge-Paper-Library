# Lifeforge Paper Library

[中文说明](./README.zh-CN.md)

`Paper Library` is a custom LifeForge module for building a shared research paper pool inside [LifeForge](https://github.com/Lifeforge-app/lifeforge), curating abstracts, ranking papers against a Zotero library, and generating lightweight AI reading aids.

It lives under `apps/longdongqiang--paper-library` and is versioned in its own Git repository, separate from the main LifeForge repository.

## What It Does

`Paper Library` combines four workflows in one module:

- Collect papers from configured RSS sources
- Fill or repair missing abstracts
- Recommend papers against a per-user Zotero library
- Enhance high-relevance papers with:
  - `TL;DR`
  - `Translated Title`
  - `Translated Abstract`

At the UI level, the module provides:

- A scored `Papers` landing page
- In-place paper detail modal with previous / next navigation across pages
- `Favorites` with folders, rename, delete, and move support
- `Review` for manual abstract inspection, correction, and clearing
- `Import` for JSON / JSONL ingestion
- `Run` for manual pipeline triggering and run history
- `Settings` for shared fetch / abstract settings and personal recommend / enhance settings

## Key Features

- Shared paper pool, per-user interpretation
  - papers are stored once
  - recommendation scores, enhancement results, and favorites remain user-specific
- Abstract-first pipeline
  - abstract extraction is its own stage, separate from RSS fetch
  - missing abstracts can be reviewed and corrected manually
- Folder-based favorites
  - save papers into a chosen folder from the list page
  - rename, delete, and move folders without losing saved papers
- Import without a file-based intermediate pipeline
  - JSON / JSONL goes straight into PocketBase
  - imported recommend / enhance results are marked explicitly as imported
- Scheduler built inside the module
  - no host-framework task system changes required
- UI aligned with LifeForge
  - uses the host theme tokens, cards, buttons, and modal system

## Why This Module Is Useful

- It keeps paper collection, abstract repair, ranking, and lightweight AI enhancement in one place instead of splitting them across scripts and viewers.
- It avoids reprocessing unchanged work where possible through per-stage input hashes.
- It supports both automated and manual workflows:
  - scheduled fetch / abstract / recommend / enhance
  - manual review and manual reruns when you want tighter control
- It is practical for real reading workflows:
  - score-first paper browsing
  - favorites folders
  - direct link-out to source pages
  - manual abstract correction before downstream recommendation and enhancement

## Current Scope

This module currently provides:

- Paper list and detail pages
- In-place paper detail modal from the list page, with next / previous navigation across pages
- Favorites with folders
- JSON / JSONL import
- Abstract review page for manual abstract inspection and correction
- Four-stage pipeline:
  - `fetch`: fetch RSS feeds and save new papers directly into PocketBase
  - `abstract`: resolve missing abstracts through configured providers and manual review follow-up
  - `recommend`: rank papers against a Zotero library
  - `enhance`: generate `TL;DR`, `Translated Title`, and `Translated Abstract`
- Shared paper pool + per-user overlay data model
- Manual run page and automatic scheduled runs
- Settings page for RSS, abstract, Zotero, and AI configuration

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
  - `fetch_enabled`, `abstract_enabled`, `recommend_enabled`, `enhance_enabled`
  - `fetch_time`, `abstract_time`, `recommend_time`, `enhance_time`
  - scheduler dedupe keys:
    - `last_fetch_schedule_key`
    - `last_abstract_schedule_key`
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
- Parses RSS into paper records
- De-duplicates before persistence
- Skips existing papers instead of overwriting them
- Writes directly to `ldq_paperlib_papers`
- Marks paper abstract readiness through `abstract_status`
  - `ready` when a valid abstract already exists in the fetched record
  - `missing` when the paper still needs abstract resolution
  - `error` when extraction logic explicitly fails
- Feed failures are recorded as failed feeds without stopping the whole fetch run

### Abstract

- Runs independently after fetch
- Only processes papers with `abstract_status = missing`
- Current provider chain is:
  - `Nature API`
  - `OpenAlex`
  - `Tavily`
- Uses batched provider calls and request timeouts
- Updates `papers.abstract` and `papers.abstract_status`
- Keeps per-run skip / failure reasons in run details rather than mutating user overlay stage state

### Recommend

- Uses the current user's Zotero credentials
- Builds / refreshes Zotero cache in PocketBase
- Computes similarity between fetched papers and Zotero collections
- Writes scores and matched collections into `ldq_paperlib_user_states`
- Can create a user overlay row on demand if one does not already exist
- Only processes papers where `abstract_status = ready`
- Uses `recommend_input_hash` so already completed unchanged papers can be skipped cleanly
- Skip reasons such as `no_abstract` and `unchanged` are tracked in current run details, not as long-lived user-state statuses

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
- Skip reasons such as `no_state`, `no_abstract`, `below_threshold`, and `unchanged` are tracked in current run details, not as long-lived user-state statuses

## Scheduling Rules

The scheduler is implemented inside the module server and does not require changes to the LifeForge host framework.

Current coordination rules:

- A new `fetch` run marks older running `fetch` runs as `failed`, then starts a new `fetch`
- A new `abstract` run marks older running `abstract` runs as `failed`
- If a `fetch` is running, `abstract` waits for `fetch` to finish
- A new `recommend` run marks older running `recommend` runs as `failed`
- If an `abstract` is running, `recommend` waits for `abstract` to finish
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
- imported overlay rows use `recommend_last_reason = imported` / `enhance_last_reason = imported`
- imported overlay defaults now align with the current stage-state model
- duplicate papers are skipped instead of overwritten

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
- Some upstream providers can still be rate-limited or unstable:
  - `Nature API`
  - `Tavily`
  - source-specific RSS feeds
- The module UI is aligned with the host modal and card system, but paper detail still has richer navigation behavior than smaller utility modals

## Repository

GitHub:

- `git@github.com:Longdongqiang928/Lifeforge-Paper-Library.git`
