import { apiClient, type ExecutionEvent, type RunLanguage } from '../services/api'

type TerminalLineType = 'info' | 'success' | 'warning' | 'error'

type RunMode = 'run' | 'step'

export type RunCodeExecutorParams = {
  language: string | undefined
  source: string
  stdin?: string
  mode?: RunMode
  onComplete?: () => void
  onEvent?: (event: ExecutionEvent) => void
  setTerminalOpen: (open: boolean) => void
  addTerminalOutput: (text: string, type?: TerminalLineType) => void
}

export type RunController = {
  sessionId: string | null
  isStepMode: boolean
  step: () => void
  stop: () => Promise<void>
}

function normalizeLanguage(language: string | undefined): RunLanguage {
  if (language === 'javascript') return 'node'
  if (language === 'python') return 'python'
  if (language === 'c') return 'c'
  if (language === 'cpp' || language === 'c++') return 'cpp'
  if (language === 'rust') return 'rust'
  return 'node'
}

function mapType(event: ExecutionEvent): TerminalLineType {
  if (event.type === 'stderr' || event.type === 'error') return 'error'
  if (event.type === 'complete') return event.exitCode === 0 ? 'success' : 'error'
  return 'info'
}

export async function runCodeExecutor(params: RunCodeExecutorParams): Promise<RunController> {
  const language = normalizeLanguage(params.language)
  const mode = params.mode ?? 'run'
  params.setTerminalOpen(true)

  const start = await apiClient.startExecution({
    language,
    source: params.source,
    stdin: params.stdin,
    stepMode: mode === 'step',
  })

  const state = {
    sessionId: start.sessionId,
    stream: apiClient.streamExecution(start.sessionId),
    completed: false,
  }
  const queuedOutput: ExecutionEvent[] = []
  let releaseStep: (() => void) | null = null
  let isFlushingQueue = false

  if (mode === 'step') {
    params.addTerminalOutput(
      'Step mode enabled: output is replayed line-by-line; use Stop to interrupt infinite loops.',
      'info',
    )
  }

  const waitForStep = async (): Promise<void> => {
    if (mode !== 'step') {
      return
    }

    await new Promise<void>((resolve) => {
      releaseStep = resolve
    })
    releaseStep = null
  }

  const flushQueuedOutput = async (): Promise<void> => {
    if (isFlushingQueue) {
      return
    }

    isFlushingQueue = true
    while (queuedOutput.length > 0) {
      const next = queuedOutput.shift()
      if (!next) {
        continue
      }
      await waitForStep()
      params.addTerminalOutput(next.message, mapType(next))
    }
    isFlushingQueue = false
  }

  state.stream.onmessage = (event) => {
    const payload = JSON.parse(event.data) as ExecutionEvent
    params.onEvent?.(payload)

    if (payload.type === 'stdout' || payload.type === 'stderr' || payload.type === 'error') {
      queuedOutput.push(payload)
      void flushQueuedOutput()
    }

    if (payload.type === 'complete') {
      state.completed = true
      state.stream.close()
      params.addTerminalOutput(payload.message, mapType(payload))
      params.onComplete?.()
    }
  }

  state.stream.onerror = () => {
    if (state.completed) {
      return
    }
    state.stream.close()
    params.addTerminalOutput('Execution stream disconnected', 'error')
    params.onComplete?.()
  }

  return {
    sessionId: state.sessionId,
    isStepMode: mode === 'step',
    step: () => {
      if (mode !== 'step') {
        return
      }
      if (releaseStep) {
        releaseStep()
      }
    },
    stop: async () => {
      if (!state.sessionId || state.completed) {
        return
      }
      await apiClient.stopExecution(state.sessionId)
    },
  }
}
