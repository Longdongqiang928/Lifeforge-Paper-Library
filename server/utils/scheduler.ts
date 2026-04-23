import dayjs from 'dayjs'

import { PIPELINE_TICK_MS } from './constants'
import { runScheduledStages } from './pipeline'

let schedulerStarted = false
let schedulerHandle: ReturnType<typeof setInterval> | null = null
let schedulerTickPromise: Promise<void> | null = null

async function tick() {
  if (schedulerTickPromise) {
    return schedulerTickPromise
  }

  schedulerTickPromise = (async () => {
    try {
      await runScheduledStages(dayjs())
    } catch (error) {
      console.error('[paper-library] scheduler tick failed', error)
    } finally {
      schedulerTickPromise = null
    }
  })()

  try {
    await schedulerTickPromise
  } finally {
    // no-op
  }
}

export function startPipelineScheduler() {
  if (schedulerStarted) return

  schedulerStarted = true
  schedulerHandle = setInterval(() => {
    void tick()
  }, PIPELINE_TICK_MS)

  void tick()
}

export function stopPipelineScheduler() {
  if (schedulerHandle) {
    clearInterval(schedulerHandle)
    schedulerHandle = null
  }

  schedulerStarted = false
}
