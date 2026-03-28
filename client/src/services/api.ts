import { config } from '../config'

type HealthResponse = {
  status: string
}

type ApiErrorResponse = {
  error?: string
}

export type AuthUser = {
  id: number
  name: string
  lastName: string
  email: string
}

export type AuthResponse = {
  token: string
  user: AuthUser
}

export type LoginPayload = {
  email: string
  password: string
}

export type RegisterPayload = {
  name: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
}

export type RunLanguage = 'python' | 'node' | 'c' | 'cpp' | 'rust'

export type ExecutePayload = {
  language: RunLanguage
  source: string
  stdin?: string
  stepMode?: boolean
}

export type StartExecutionResponse = {
  sessionId: string
}

export type ExecutionEvent = {
  type: 'scan' | 'status' | 'stdout' | 'stderr' | 'complete' | 'error'
  message: string
  timestamp: string
  exitCode?: number
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const rawBody = await response.text()
  let data: unknown = null

  if (rawBody) {
    try {
      data = JSON.parse(rawBody)
    } catch {
      data = rawBody
    }
  }

  if (!response.ok) {
    const maybeError = data as ApiErrorResponse | null
    const message =
      maybeError && typeof maybeError === 'object' && typeof maybeError.error === 'string'
        ? maybeError.error
        : `Request failed: ${response.status}`

    throw new Error(message)
  }

  return data as T
}

async function health(): Promise<HealthResponse> {
  return requestJson<HealthResponse>('/api/health')
}

async function login(payload: LoginPayload): Promise<AuthResponse> {
  return requestJson<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

async function register(payload: RegisterPayload): Promise<AuthResponse> {
  return requestJson<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

async function startExecution(payload: ExecutePayload): Promise<StartExecutionResponse> {
  return requestJson<StartExecutionResponse>('/api/execute', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

async function stopExecution(sessionId: string): Promise<{ sessionId: string; status: string }> {
  return requestJson<{ sessionId: string; status: string }>(`/api/execute/${sessionId}/stop`, {
    method: 'POST',
  })
}

function streamExecution(sessionId: string): EventSource {
  return new EventSource(`${config.apiBaseUrl}/api/execute/${sessionId}/stream`)
}

export const apiClient = {
  health,
  login,
  register,
  startExecution,
  stopExecution,
  streamExecution,
}
