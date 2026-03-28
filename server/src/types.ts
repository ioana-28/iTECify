export type RunLanguage = 'node' | 'python' | 'c' | 'cpp' | 'rust'

export type RunCodeRequest = {
  language: RunLanguage
  source: string
  stdin?: string
  stepMode?: boolean
}

export type RunCodeResult = {
  language: RunLanguage
  output: string
  exitCode: number
}

export type ExecutionSessionEventType =
  | 'scan'
  | 'status'
  | 'stdout'
  | 'stderr'
  | 'complete'
  | 'error'

export type ExecutionSessionEvent = {
  type: ExecutionSessionEventType
  message: string
  timestamp: string
  exitCode?: number
}

export type StartExecutionResponse = {
  sessionId: string
}
