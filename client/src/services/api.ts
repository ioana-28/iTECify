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

export type Room = {
  id: string
  owner_user_id: number
  name: string | null
  invite_code: string
  created_at: string
}

export type Project = {
  id: string
  name: string
  primaryLanguage: string
  roomId: string
  roomInviteCode: string
  treeSnapshot: string
  createdAt: string
  updatedAt: string
  lastOpenedAt: string
}

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

export type EditFileWithAiPayload = {
  content: string
  instruction: string
  language: string
}

export type AiDiffChunk = {
  id: string
  type: 'added' | 'removed' | 'modified'
  oldStartLine: number
  oldEndLine: number
  newStartLine: number
  newEndLine: number
  oldLines: string[]
  newLines: string[]
}

export type EditFileWithAiResponse = {
  content: string
  chunks: AiDiffChunk[]
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const token = window.localStorage.getItem('authToken')
  return token && token.trim().length > 0 ? token : null
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken()
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

async function createRoom(name?: string): Promise<{ room: Room }> {
  return requestJson<{ room: Room }>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

async function joinRoom(code: string): Promise<{ room: Room }> {
  return requestJson<{ room: Room }>('/api/rooms/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

async function listRooms(): Promise<{ rooms: Room[] }> {
  return requestJson<{ rooms: Room[] }>('/api/rooms')
}

async function createProject(payload: {
  name: string
  primaryLanguage: string
  treeSnapshot?: unknown
}): Promise<{ project: Project; room: Room }> {
  return requestJson<{ project: Project; room: Room }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

async function listProjects(): Promise<{ projects: Project[] }> {
  return requestJson<{ projects: Project[] }>('/api/projects')
}

async function joinProjectByCode(code: string): Promise<{ project: Project; room: Room }> {
  return requestJson<{ project: Project; room: Room }>('/api/projects/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

async function openProject(projectId: string): Promise<{ project: Project; room: Room }> {
  return requestJson<{ project: Project; room: Room }>(`/api/projects/${projectId}/open`, {
    method: 'POST',
  })
}

async function editFileWithAi(payload: EditFileWithAiPayload): Promise<EditFileWithAiResponse> {
  return requestJson<EditFileWithAiResponse>('/api/ai/edit-file', {
    method: 'POST',
    body: JSON.stringify(payload),
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
  createRoom,
  joinRoom,
  listRooms,
  createProject,
  listProjects,
  joinProjectByCode,
  openProject,
  editFileWithAi,
  streamExecution,
}
