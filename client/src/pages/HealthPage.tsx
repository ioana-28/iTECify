import { useState } from 'react'
import { apiClient } from '../services/api'

export function HealthPage() {
  const [status, setStatus] = useState('unknown')

  async function onRefresh() {
    try {
      const result = await apiClient.health()
      setStatus(result.status)
    } catch (error) {
      setStatus(`error: ${(error as Error).message}`)
    }
  }

  return (
    <section className="health-page">
      <h2>Backend Health</h2>
      <p>Current status: {status}</p>
      <button onClick={onRefresh}>Refresh health</button>
    </section>
  )
}
