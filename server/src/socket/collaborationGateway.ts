import type { Server } from 'socket.io'

type JoinPayload = {
  roomId: string
  userId: string
}

type CodeChangePayload = {
  roomId: string
  content: string
}

export function registerCollaborationGateway(io: Server): void {
  io.on('connection', (socket) => {
    socket.on('room:join', (payload: JoinPayload) => {
      socket.join(payload.roomId)
      io.to(payload.roomId).emit('room:user-joined', {
        roomId: payload.roomId,
        userId: payload.userId,
      })
    })

    socket.on('editor:change', (payload: CodeChangePayload) => {
      socket.to(payload.roomId).emit('editor:patch', payload)
    })
  })
}
