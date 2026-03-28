import { apiClient, type ExecutionEvent, type RunLanguage } from '../services/api'

type TerminalLineType = 'info' | 'success' | 'warning' | 'error'

export type RunCodeExecutorParams = {
  language: string | undefined
  source: string
  stdin?: string
  setTerminalOpen: (open: boolean) => void
  addTerminalOutput: (text: string, type?: TerminalLineType) => void
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

export async function runCodeExecutor(params: RunCodeExecutorParams): Promise<void> {
  const language = normalizeLanguage(params.language)
  params.setTerminalOpen(true)

  const start = await apiClient.startExecution({
    language,
    source: params.source,
    stdin: params.stdin,
  })

  await new Promise<void>((resolve, reject) => {
    const source = apiClient.streamExecution(start.sessionId)

    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as ExecutionEvent
      
      // Only show actual code output (stdout, stderr, error), filter out setup logs
      if (payload.type === 'stdout' || payload.type === 'stderr' || payload.type === 'error') {
        params.addTerminalOutput(payload.message, mapType(payload))
      }

      if (payload.type === 'complete') {
        source.close()
        resolve()
      }
    }

    source.onerror = () => {
      source.close()
      reject(new Error('Execution stream disconnected'))
    }
  })
}
