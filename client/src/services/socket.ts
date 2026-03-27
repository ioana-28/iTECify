import { io, type Socket } from 'socket.io-client'
import { config } from '../config'

export function createCollabSocket(roomId: string): Socket {
  return io(config.socketUrl, {
    autoConnect: true,
    query: { roomId },
  })
}
