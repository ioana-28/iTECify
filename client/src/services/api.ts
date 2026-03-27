import { config } from '../config'

type HealthResponse = {
  status: string
}

async function health(): Promise<HealthResponse> {
  const response = await fetch(`${config.apiBaseUrl}/api/health`)
  if (!response.ok) {
    throw new Error(`Health request failed: ${response.status}`)
  }

  return response.json() as Promise<HealthResponse>
}

export const apiClient = {
  health,
}
