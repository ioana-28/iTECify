import { useEffect, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import { apiClient } from '../services/api'
import { createCollabSocket } from '../services/socket'

export function EditorPage() {
  const roomId = 'demo-room'
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    socketRef.current = createCollabSocket(roomId)

    return () => {
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [roomId])

  async function checkBackend() {
    try {
      const status = await apiClient.health()
      alert(`Backend status: ${status.status}`)
    } catch (error) {
      alert((error as Error).message)
    }
  }

  function pingSocket() {
    socketRef.current?.emit('room:join', { roomId, userId: 'demo-user' })
    alert('Socket.IO join event emitted (placeholder).')
  }

  return (
    <section className="editor-layout">
      <aside className="panel files">
        <h2>Files</h2>
        <ul>
          <li>src/main.ts</li>
          <li>src/App.tsx</li>
          <li>Dockerfile</li>
        </ul>
      </aside>

      <article className="panel editor">
        <h2>Collaborative Editor</h2>
        <textarea
          defaultValue={'// Boilerplate editor placeholder\nconsole.log("Hello iTECify");'}
          rows={18}
          aria-label="Editor"
        />
      </article>

      <aside className="panel right">
        <h2>Participants</h2>
        <ul>
          <li>demo-user</li>
        </ul>

        <h2>Runtime</h2>
        <button onClick={checkBackend}>Check API health</button>
        <button onClick={pingSocket}>Emit Socket.IO join</button>

        <h2>Output</h2>
        <pre>Runner output placeholder...</pre>
      </aside>
    </section>
  )
}
