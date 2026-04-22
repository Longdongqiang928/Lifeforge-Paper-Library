import dayjs from 'dayjs'
import { spawnSync } from 'node:child_process'

import { PIPELINE_TICK_MS } from './constants'
import { runScheduledStages } from './pipeline'

let schedulerStarted = false
let schedulerHandle: ReturnType<typeof setInterval> | null = null

function getSystemNow() {
  const result = spawnSync('date', ['+%Y-%m-%dT%H:%M:%S%:z'], {
    encoding: 'utf8'
  })

  if (result.status === 0) {
    const raw = result.stdout.trim()
    const parsed = dayjs(raw)

    if (parsed.isValid()) {
      return parsed
    }
  }

  return dayjs()
}

async function tick() {
  try {
    await runScheduledStages(getSystemNow())
  } catch (error) {
    console.error('[paper-library] scheduler tick failed', error)
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
