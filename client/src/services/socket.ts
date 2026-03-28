import { io, type Socket } from 'socket.io-client'
import { config } from '../config'

export function createCollabSocket(roomId: string): Socket {
  const token = localStorage.getItem('authToken')
  return io(config.socketUrl, {
    autoConnect: true,
    query: { roomId },
    auth: token ? { token } : undefined,
    extraHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
}
