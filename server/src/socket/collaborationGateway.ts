import type { Server, Socket } from 'socket.io'

type JoinPayload = {
  roomId: string
  userId: string
}

type EditorInsertOperation = {
  type: 'insert'
  pos: number
  text: string
}

type EditorDeleteOperation = {
  type: 'delete'
  pos: number
  length: number
}

type EditorTextOperation = EditorInsertOperation | EditorDeleteOperation

type EditorChangePayload = {
  roomId: string
  docId: string
  userId: string
  baseVersion: number
  opId: string
  op: EditorTextOperation
}

type CursorMovePayload = {
  roomId: string
  userId: string
  docId: string
  line: number
  column: number
  selectionStart?: number
  selectionEnd?: number
  timestamp?: number
}

type AiProposeBlockPayload = {
  roomId: string
  proposalId: string
  userId: string
  block: {
    type: string
    content: string
  }
  context?: {
    docId?: string
    selectionStart?: number
    selectionEnd?: number
  }
  createdAt?: number
}

type AiDecisionPayload = {
  roomId: string
  proposalId: string
  userId: string
  decision: 'accept' | 'reject'
  reason?: string
  decidedAt?: number
}

type TerminalStreamPayload = {
  roomId: string
  streamId: string
  source: 'stdout' | 'stderr' | 'system'
  sequence: number
  chunk: string
  done?: boolean
  timestamp?: number
}

type TerminalOutputData = Omit<TerminalStreamPayload, 'roomId'>

type GatewayErrorPayload = {
  event: string
  code:
    | 'INVALID_PAYLOAD'
    | 'INVALID_OPERATION'
    | 'UNAUTHORIZED'
    | 'ROOM_NOT_JOINED'
    | 'RATE_LIMITED'
  message: string
}

const RATE_LIMITS = {
  'cursor:move': { limit: 60, windowMs: 1000 },
  'editor:change': { limit: 120, windowMs: 1000 },
  'terminal:stream': { limit: 120, windowMs: 1000 },
  'ai:propose-block': { limit: 40, windowMs: 10_000 },
  'ai:decision': { limit: 40, windowMs: 10_000 },
} as const

const eventTimestamps = new Map<string, number[]>()
const roomStates = new Map<string, string>()

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value)
}

function emitGatewayError(
  socket: Socket,
  event: GatewayErrorPayload['event'],
  code: GatewayErrorPayload['code'],
  message: string,
): void {
  console.warn(`[socket][${event}] ${code}: ${message}`)
  socket.emit('socket:error', { event, code, message } satisfies GatewayErrorPayload)
}

function wasRateLimitExceeded(socket: Socket, event: keyof typeof RATE_LIMITS): boolean {
  const now = Date.now()
  const key = `${socket.id}:${event}`
  const { limit, windowMs } = RATE_LIMITS[event]
  const timestamps = eventTimestamps.get(key) ?? []
  const fresh = timestamps.filter((timestamp) => now - timestamp <= windowMs)

  if (fresh.length >= limit) {
    eventTimestamps.set(key, fresh)
    return true
  }

  fresh.push(now)
  eventTimestamps.set(key, fresh)
  return false
}

function markRoomAsJoined(socket: Socket, roomId: string): void {
  const joinedRooms = socket.data.joinedRooms as Set<string> | undefined
  if (joinedRooms) {
    joinedRooms.add(roomId)
    return
  }

  socket.data.joinedRooms = new Set([roomId])
}

function hasJoinedRoom(socket: Socket, roomId: string): boolean {
  const joinedRooms = socket.data.joinedRooms as Set<string> | undefined
  return joinedRooms?.has(roomId) ?? false
}

function authorizeRoomAction(
  _socket: Socket,
  _roomId: string,
  _event: string,
): boolean {
  // Placeholder hook for integrating auth/ACL checks.
  return true
}

function isJoinPayload(payload: unknown): payload is JoinPayload {
  return (
    isObject(payload) &&
    isNonEmptyString(payload.roomId) &&
    isNonEmptyString(payload.userId)
  )
}

function isEditorTextOperation(payload: unknown): payload is EditorTextOperation {
  if (!isObject(payload) || !isNonEmptyString(payload.type) || !isSafeInteger(payload.pos)) {
    return false
  }

  if (payload.type === 'insert') {
    return isNonEmptyString(payload.text)
  }

  if (payload.type === 'delete') {
    return isSafeInteger(payload.length) && payload.length > 0
  }

  return false
}

function isEditorChangePayload(payload: unknown): payload is EditorChangePayload {
  return (
    isObject(payload) &&
    isNonEmptyString(payload.roomId) &&
    isNonEmptyString(payload.docId) &&
    isNonEmptyString(payload.userId) &&
    isSafeInteger(payload.baseVersion) &&
    isNonEmptyString(payload.opId) &&
    isEditorTextOperation(payload.op)
  )
}

function isCursorMovePayload(payload: unknown): payload is CursorMovePayload {
  if (!isObject(payload)) {
    return false
  }

  const hasRequiredFields =
    isNonEmptyString(payload.roomId) &&
    isNonEmptyString(payload.userId) &&
    isNonEmptyString(payload.docId) &&
    isNumber(payload.line) &&
    isNumber(payload.column)

  if (!hasRequiredFields) {
    return false
  }

  if (payload.selectionStart !== undefined && !isNumber(payload.selectionStart)) {
    return false
  }

  if (payload.selectionEnd !== undefined && !isNumber(payload.selectionEnd)) {
    return false
  }

  if (payload.timestamp !== undefined && !isNumber(payload.timestamp)) {
    return false
  }

  return true
}

function isAiProposeBlockPayload(payload: unknown): payload is AiProposeBlockPayload {
  if (!isObject(payload) || !isObject(payload.block)) {
    return false
  }

  const hasRequiredFields =
    isNonEmptyString(payload.roomId) &&
    isNonEmptyString(payload.proposalId) &&
    isNonEmptyString(payload.userId) &&
    isNonEmptyString(payload.block.type) &&
    isNonEmptyString(payload.block.content)

  if (!hasRequiredFields) {
    return false
  }

  if (payload.context !== undefined) {
    if (!isObject(payload.context)) {
      return false
    }

    if (payload.context.docId !== undefined && !isNonEmptyString(payload.context.docId)) {
      return false
    }

    if (
      payload.context.selectionStart !== undefined &&
      !isNumber(payload.context.selectionStart)
    ) {
      return false
    }

    if (payload.context.selectionEnd !== undefined && !isNumber(payload.context.selectionEnd)) {
      return false
    }
  }

  if (payload.createdAt !== undefined && !isNumber(payload.createdAt)) {
    return false
  }

  return true
}

function isAiDecisionPayload(payload: unknown): payload is AiDecisionPayload {
  if (!isObject(payload)) {
    return false
  }

  const hasRequiredFields =
    isNonEmptyString(payload.roomId) &&
    isNonEmptyString(payload.proposalId) &&
    isNonEmptyString(payload.userId) &&
    (payload.decision === 'accept' || payload.decision === 'reject')

  if (!hasRequiredFields) {
    return false
  }

  if (payload.reason !== undefined && !isNonEmptyString(payload.reason)) {
    return false
  }

  if (payload.decidedAt !== undefined && !isNumber(payload.decidedAt)) {
    return false
  }

  return true
}

function isTerminalStreamPayload(payload: unknown): payload is TerminalStreamPayload {
  if (!isObject(payload)) {
    return false
  }

  const hasRequiredFields =
    isNonEmptyString(payload.roomId) &&
    isNonEmptyString(payload.streamId) &&
    (payload.source === 'stdout' || payload.source === 'stderr' || payload.source === 'system') &&
    isSafeInteger(payload.sequence) &&
    isNonEmptyString(payload.chunk)

  if (!hasRequiredFields) {
    return false
  }

  if (payload.done !== undefined && typeof payload.done !== 'boolean') {
    return false
  }

  if (payload.timestamp !== undefined && !isNumber(payload.timestamp)) {
    return false
  }

  return true
}

function getOrCreateRoomState(roomId: string): string {
  const current = roomStates.get(roomId)
  if (current !== undefined) {
    return current
  }

  roomStates.set(roomId, '')
  return ''
}

function applyEditorOperation(
  content: string,
  operation: EditorTextOperation,
): { ok: true; nextContent: string } | { ok: false; message: string } {
  if (operation.pos < 0 || operation.pos > content.length) {
    return {
      ok: false,
      message: `Operation position ${operation.pos} is out of bounds for content length ${content.length}.`,
    }
  }

  if (operation.type === 'insert') {
    return {
      ok: true,
      nextContent: `${content.slice(0, operation.pos)}${operation.text}${content.slice(operation.pos)}`,
    }
  }

  const deleteEnd = operation.pos + operation.length
  if (deleteEnd > content.length) {
    return {
      ok: false,
      message: `Delete range [${operation.pos}, ${deleteEnd}) exceeds content length ${content.length}.`,
    }
  }

  return {
    ok: true,
    nextContent: `${content.slice(0, operation.pos)}${content.slice(deleteEnd)}`,
  }
}

function isTerminalOutputData(data: unknown): data is TerminalOutputData {
  if (!isObject(data)) {
    return false
  }

  return isTerminalStreamPayload({ roomId: 'validation-room', ...data })
}

export function broadcastTerminalOutput(io: Server, roomId: string, data: TerminalOutputData): void {
  if (!isNonEmptyString(roomId)) {
    throw new TypeError('broadcastTerminalOutput requires a non-empty roomId.')
  }

  if (!isTerminalOutputData(data)) {
    throw new TypeError('broadcastTerminalOutput received invalid terminal output payload.')
  }

  io.to(roomId).emit('terminal:output', {
    roomId,
    ...data,
  } satisfies TerminalStreamPayload)
}

function enforceEventAccess(
  socket: Socket,
  roomId: string,
  eventName: keyof typeof RATE_LIMITS,
): boolean {
  if (!hasJoinedRoom(socket, roomId)) {
    emitGatewayError(
      socket,
      eventName,
      'ROOM_NOT_JOINED',
      `Join room "${roomId}" before emitting ${eventName}.`,
    )
    return false
  }

  if (!authorizeRoomAction(socket, roomId, eventName)) {
    emitGatewayError(socket, eventName, 'UNAUTHORIZED', `Not authorized for room "${roomId}".`)
    return false
  }

  if (wasRateLimitExceeded(socket, eventName)) {
    emitGatewayError(socket, eventName, 'RATE_LIMITED', `Rate limit exceeded for ${eventName}.`)
    return false
  }

  return true
}

export function registerCollaborationGateway(io: Server): void {
  io.on('connection', (socket) => {
    socket.on('room:join', (payload: unknown) => {
      if (!isJoinPayload(payload)) {
        emitGatewayError(socket, 'room:join', 'INVALID_PAYLOAD', 'Invalid room:join payload.')
        return
      }

      if (!authorizeRoomAction(socket, payload.roomId, 'room:join')) {
        emitGatewayError(socket, 'room:join', 'UNAUTHORIZED', 'Not authorized to join this room.')
        return
      }

      socket.join(payload.roomId)
      markRoomAsJoined(socket, payload.roomId)
      const latestContent = getOrCreateRoomState(payload.roomId)

      socket.emit('room:state-sync', {
        roomId: payload.roomId,
        content: latestContent,
      })

      io.to(payload.roomId).emit('room:user-joined', {
        roomId: payload.roomId,
        userId: payload.userId,
      })
    })

    socket.on('editor:change', (payload: unknown) => {
      if (!isEditorChangePayload(payload)) {
        emitGatewayError(
          socket,
          'editor:change',
          'INVALID_PAYLOAD',
          'Invalid editor:change payload.',
        )
        return
      }

      if (!enforceEventAccess(socket, payload.roomId, 'editor:change')) {
        return
      }

      const currentContent = getOrCreateRoomState(payload.roomId)
      const updatedState = applyEditorOperation(currentContent, payload.op)
      if (!updatedState.ok) {
        emitGatewayError(socket, 'editor:change', 'INVALID_OPERATION', updatedState.message)
        return
      }

      roomStates.set(payload.roomId, updatedState.nextContent)
      socket.to(payload.roomId).emit('editor:patch', payload)
    })

    socket.on('cursor:move', (payload: unknown) => {
      if (!isCursorMovePayload(payload)) {
        emitGatewayError(socket, 'cursor:move', 'INVALID_PAYLOAD', 'Invalid cursor:move payload.')
        return
      }

      if (!enforceEventAccess(socket, payload.roomId, 'cursor:move')) {
        return
      }

      socket.to(payload.roomId).emit('cursor:update', payload)
    })

    socket.on('ai:propose-block', (payload: unknown) => {
      if (!isAiProposeBlockPayload(payload)) {
        emitGatewayError(
          socket,
          'ai:propose-block',
          'INVALID_PAYLOAD',
          'Invalid ai:propose-block payload.',
        )
        return
      }

      if (!enforceEventAccess(socket, payload.roomId, 'ai:propose-block')) {
        return
      }

      io.to(payload.roomId).emit('ai:block-proposed', payload)
    })

    socket.on('ai:decision', (payload: unknown) => {
      if (!isAiDecisionPayload(payload)) {
        emitGatewayError(socket, 'ai:decision', 'INVALID_PAYLOAD', 'Invalid ai:decision payload.')
        return
      }

      if (!enforceEventAccess(socket, payload.roomId, 'ai:decision')) {
        return
      }

      io.to(payload.roomId).emit('ai:decision-applied', payload)
    })

    socket.on('terminal:stream', (payload: unknown) => {
      if (!isTerminalStreamPayload(payload)) {
        emitGatewayError(
          socket,
          'terminal:stream',
          'INVALID_PAYLOAD',
          'Invalid terminal:stream payload.',
        )
        return
      }

      if (!enforceEventAccess(socket, payload.roomId, 'terminal:stream')) {
        return
      }

      broadcastTerminalOutput(io, payload.roomId, {
        streamId: payload.streamId,
        source: payload.source,
        sequence: payload.sequence,
        chunk: payload.chunk,
        done: payload.done,
        timestamp: payload.timestamp,
      })
    })

    socket.on('disconnect', () => {
      eventTimestamps.forEach((_value, key) => {
        if (key.startsWith(`${socket.id}:`)) {
          eventTimestamps.delete(key)
        }
      })
    })
  })
}
