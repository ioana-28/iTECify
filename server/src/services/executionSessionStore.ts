import type { ExecutionSessionEvent } from '../types'

type SessionState = {
  events: ExecutionSessionEvent[]
  subscribers: Set<(event: ExecutionSessionEvent) => void>
  isCompleted: boolean
}

class ExecutionSessionStore {
  private readonly sessions = new Map<string, SessionState>()

  createSession(sessionId: string): void {
    this.sessions.set(sessionId, {
      events: [],
      subscribers: new Set(),
      isCompleted: false,
    })
  }

  addEvent(sessionId: string, event: ExecutionSessionEvent): void {
    const state = this.sessions.get(sessionId)
    if (!state) return

    state.events.push(event)
    for (const subscriber of state.subscribers) {
      subscriber(event)
    }
  }

  completeSession(sessionId: string): void {
    const state = this.sessions.get(sessionId)
    if (!state) return
    state.isCompleted = true
  }

  getState(sessionId: string): SessionState | null {
    return this.sessions.get(sessionId) ?? null
  }

  subscribe(sessionId: string, subscriber: (event: ExecutionSessionEvent) => void): (() => void) | null {
    const state = this.sessions.get(sessionId)
    if (!state) return null

    state.subscribers.add(subscriber)
    return () => {
      state.subscribers.delete(subscriber)
    }
  }
}

export const executionSessionStore = new ExecutionSessionStore()
