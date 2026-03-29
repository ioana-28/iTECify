import jwt, { type JwtPayload, type Secret } from 'jsonwebtoken'
import type { Server, Socket } from 'socket.io'
import { config } from '../config'
import {
  createRoomFileNode,
  getRoomFileNode,
  listRoomFileNodes,
  type RoomFileNodeRow,
} from '../services/roomFileNodeRepository'
import {
  appendFileVersion,
  getLatestFileVersion,
  type RoomFileVersionRow,
} from '../services/roomFileVersionRepository'
import { isMember } from '../services/roomRepository'
import { scanCode } from '../services/vulnerabilityScanner'

type JoinPayload = {
  roomId: string
  userId: string
  docId: string
}

type TreeSyncPayload = {
  roomId: string
}

type TreeCreatePayload = {
  roomId: string
  name: string
  nodeType: 'file' | 'folder'
  parentPath?: string | null
}

type TreeNodeDto = {
  path: string
  name: string
  type: 'file' | 'folder'
  parentPath: string | null
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

type CodeExecutePayload = {
  roomId: string
  userId: string
  language: string
  source: string
  stdin?: string
  stepMode?: boolean
}

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
  'tree:sync': { limit: 30, windowMs: 1000 },
  'tree:create': { limit: 30, windowMs: 1000 },
} as const

const eventTimestamps = new Map<string, number[]>()
const roomFileStates = new Map<string, { content: string; version: number }>()

function getRoomFileKey(roomId: string, docId: string): string {
  return `${roomId}::${docId}`
}

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

function isString(value: unknown): value is string {
  return typeof value === 'string'
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

function extractSocketToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token
  if (isNonEmptyString(authToken)) {
    return authToken.trim()
  }

  const authHeader = socket.handshake.headers.authorization
  if (typeof authHeader !== 'string' || authHeader.trim().length === 0) {
    return null
  }

  const [scheme, token] = authHeader.trim().split(/\s+/, 2)
  if (scheme?.toLowerCase() === 'bearer' && isNonEmptyString(token)) {
    return token.trim()
  }

  if (!authHeader.includes(' ') && isNonEmptyString(authHeader)) {
    return authHeader.trim()
  }

  return null
}

function parseJwtUserId(token: string): number | null {
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret as Secret)
    const subject =
      typeof decoded === 'string'
        ? null
        : ((decoded as JwtPayload).sub ?? (decoded as { sub?: unknown }).sub)

    const userId =
      typeof subject === 'string'
        ? Number(subject)
        : typeof subject === 'number'
          ? subject
          : Number.NaN

    return Number.isSafeInteger(userId) && userId > 0 ? userId : null
  } catch {
    return null
  }
}

async function authorizeRoomAction(
  socket: Socket,
  roomId: string,
  _event: string,
): Promise<boolean> {
  const authenticatedUserId =
    typeof socket.data.userId === 'number' && Number.isSafeInteger(socket.data.userId)
      ? socket.data.userId
      : null

  if (!authenticatedUserId) {
    return false
  }

  try {
    return await isMember(roomId, authenticatedUserId)
  } catch (error) {
    console.error(`[socket][authz] Failed to verify room membership for room "${roomId}":`, error)
    return false
  }
}

function isJoinPayload(payload: unknown): payload is JoinPayload {
  return (
    isObject(payload) &&
    isNonEmptyString(payload.roomId) &&
    isNonEmptyString(payload.userId) &&
    isNonEmptyString(payload.docId)
  )
}

function isTreeSyncPayload(payload: unknown): payload is TreeSyncPayload {
  return isObject(payload) && isNonEmptyString(payload.roomId)
}

function isTreeCreatePayload(payload: unknown): payload is TreeCreatePayload {
  if (!isObject(payload)) {
    return false
  }

  const hasRequired =
    isNonEmptyString(payload.roomId) &&
    isNonEmptyString(payload.name) &&
    (payload.nodeType === 'file' || payload.nodeType === 'folder')
  if (!hasRequired) {
    return false
  }

  if (payload.parentPath !== undefined && payload.parentPath !== null && !isNonEmptyString(payload.parentPath)) {
    return false
  }

  return true
}

function isEditorTextOperation(payload: unknown): payload is EditorTextOperation {
  if (!isObject(payload) || !isNonEmptyString(payload.type) || !isSafeInteger(payload.pos)) {
    return false
  }

  if (payload.type === 'insert') {
    return isString(payload.text)
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

function setRoomFileState(roomId: string, docId: string, content: string, version: number): void {
  roomFileStates.set(getRoomFileKey(roomId, docId), { content, version })
}

function getRoomFileState(roomId: string, docId: string): { content: string; version: number } | null {
  const current = roomFileStates.get(getRoomFileKey(roomId, docId))
  return current ?? null
}

async function getOrLoadRoomFileState(
  roomId: string,
  docId: string,
): Promise<{ content: string; version: number }> {
  const current = getRoomFileState(roomId, docId)
  if (current !== null) {
    return current
  }

  const latest = await getLatestFileVersion(roomId, docId)
  if (!latest) {
    const initial = { content: '', version: 0 }
    setRoomFileState(roomId, docId, initial.content, initial.version)
    return initial
  }

  const loaded = { content: latest.content, version: latest.version }
  setRoomFileState(roomId, docId, loaded.content, loaded.version)
  return loaded
}

function applySavedRowToState(row: RoomFileVersionRow): void {
  setRoomFileState(row.room_id, row.file_path, row.content, row.version)
}

function toTreeNodeDto(node: RoomFileNodeRow): TreeNodeDto {
  return {
    path: node.path,
    name: node.name,
    type: node.type,
    parentPath: node.parent_path,
  }
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

function isCodeExecutePayload(payload: unknown): payload is CodeExecutePayload {
  if (!isObject(payload)) {
    return false
  }

  const hasRequiredFields =
    isNonEmptyString(payload.roomId) &&
    isNonEmptyString(payload.userId) &&
    isNonEmptyString(payload.language) &&
    isString(payload.source)
  if (!hasRequiredFields) {
    return false
  }

  if (payload.stdin !== undefined && !isString(payload.stdin)) {
    return false
  }

  if (payload.stepMode !== undefined && typeof payload.stepMode !== 'boolean') {
    return false
  }

  return true
}

function buildChaosMessage(type: string | null): string {
  if (type === 'file_deletion') {
    return "Diva, why are you trying to get rid of my stuff? This isn't a breakup!"
  }

  if (type === 'rce_attack') {
    return 'Honey, the only thing you should be executing is a better outfit. Leave my server alone!'
  }

  if (type === 'eval_chaos') {
    return "Oh, look at you trying to be 'sneaky' with eval(). That's so last season, darling."
  }

  return 'Security diva says no: suspicious behavior detected.'
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
): Promise<boolean> {
  return enforceEventAccessInternal(socket, roomId, eventName)
}

async function enforceEventAccessInternal(
  socket: Socket,
  roomId: string,
  eventName: keyof typeof RATE_LIMITS,
): Promise<boolean> {
  if (!hasJoinedRoom(socket, roomId)) {
    emitGatewayError(
      socket,
      eventName,
      'ROOM_NOT_JOINED',
      `Join room "${roomId}" before emitting ${eventName}.`,
    )
    return false
  }

  if (!(await authorizeRoomAction(socket, roomId, eventName))) {
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
  io.use((socket, next) => {
    const token = extractSocketToken(socket)
    if (!token) {
      next()
      return
    }

    const userId = parseJwtUserId(token)
    if (userId) {
      socket.data.userId = userId
    }

    next()
  })

  io.on('connection', (socket) => {
    socket.on('room:join', async (payload: unknown) => {
      try {
        if (!isJoinPayload(payload)) {
          emitGatewayError(socket, 'room:join', 'INVALID_PAYLOAD', 'Invalid room:join payload.')
          return
        }

        if (!(await authorizeRoomAction(socket, payload.roomId, 'room:join'))) {
          emitGatewayError(socket, 'room:join', 'UNAUTHORIZED', 'Not authorized to join this room.')
          return
        }

        const fileNode = await getRoomFileNode(payload.roomId, payload.docId)
        if (!fileNode || fileNode.type !== 'file') {
          emitGatewayError(socket, 'room:join', 'INVALID_OPERATION', 'Target file does not exist.')
          return
        }

        const alreadyJoined = hasJoinedRoom(socket, payload.roomId)
        socket.join(payload.roomId)
        markRoomAsJoined(socket, payload.roomId)
        const latestState = await getOrLoadRoomFileState(payload.roomId, payload.docId)

        socket.emit('room:state-sync', {
          roomId: payload.roomId,
          filePath: payload.docId,
          content: latestState.content,
          baseVersion: latestState.version,
        })

        if (!alreadyJoined) {
          io.to(payload.roomId).emit('room:user-joined', {
            roomId: payload.roomId,
            userId: payload.userId,
          })
        }
      } catch (error) {
        console.error('[socket][room:join] Failed to load room file state:', error)
        emitGatewayError(socket, 'room:join', 'INVALID_OPERATION', 'Failed to load room file state.')
      }
    })

    socket.on('tree:sync', async (payload: unknown) => {
      try {
        if (!isTreeSyncPayload(payload)) {
          emitGatewayError(socket, 'tree:sync', 'INVALID_PAYLOAD', 'Invalid tree:sync payload.')
          return
        }

        if (!(await authorizeRoomAction(socket, payload.roomId, 'tree:sync'))) {
          emitGatewayError(socket, 'tree:sync', 'UNAUTHORIZED', 'Not authorized to load this tree.')
          return
        }

        if (wasRateLimitExceeded(socket, 'tree:sync')) {
          emitGatewayError(socket, 'tree:sync', 'RATE_LIMITED', 'Rate limit exceeded for tree:sync.')
          return
        }

        const alreadyJoined = hasJoinedRoom(socket, payload.roomId)
        if (!alreadyJoined) {
          socket.join(payload.roomId)
          markRoomAsJoined(socket, payload.roomId)
        }

        const nodes = await listRoomFileNodes(payload.roomId)
        socket.emit('tree:state-sync', {
          roomId: payload.roomId,
          nodes: nodes.map(toTreeNodeDto),
        })
      } catch (error) {
        console.error('[socket][tree:sync] Failed to load tree:', error)
        emitGatewayError(socket, 'tree:sync', 'INVALID_OPERATION', 'Failed to load file tree.')
      }
    })

    socket.on('tree:create', async (payload: unknown) => {
      try {
        if (!isTreeCreatePayload(payload)) {
          emitGatewayError(socket, 'tree:create', 'INVALID_PAYLOAD', 'Invalid tree:create payload.')
          return
        }

        if (!(await authorizeRoomAction(socket, payload.roomId, 'tree:create'))) {
          emitGatewayError(socket, 'tree:create', 'UNAUTHORIZED', 'Not authorized to modify this tree.')
          return
        }

        if (wasRateLimitExceeded(socket, 'tree:create')) {
          emitGatewayError(socket, 'tree:create', 'RATE_LIMITED', 'Rate limit exceeded for tree:create.')
          return
        }

        const alreadyJoined = hasJoinedRoom(socket, payload.roomId)
        if (!alreadyJoined) {
          socket.join(payload.roomId)
          markRoomAsJoined(socket, payload.roomId)
        }

        const authenticatedUserId = socket.data.userId as number | undefined
        if (!authenticatedUserId || !Number.isSafeInteger(authenticatedUserId) || authenticatedUserId <= 0) {
          emitGatewayError(socket, 'tree:create', 'UNAUTHORIZED', 'Authenticated user is required.')
          return
        }

        const createdNode = await createRoomFileNode({
          roomId: payload.roomId,
          name: payload.name,
          type: payload.nodeType,
          parentPath: payload.parentPath ?? null,
          createdByUserId: authenticatedUserId,
        })

        io.to(payload.roomId).emit('tree:node-created', {
          roomId: payload.roomId,
          node: toTreeNodeDto(createdNode),
        })
      } catch (error) {
        console.error('[socket][tree:create] Failed to create node:', error)
        const message = error instanceof Error ? error.message : 'Failed to create file tree node.'
        emitGatewayError(socket, 'tree:create', 'INVALID_OPERATION', message)
      }
    })

    socket.on('editor:change', async (payload: unknown) => {
      try {
        if (!isEditorChangePayload(payload)) {
          emitGatewayError(
            socket,
            'editor:change',
            'INVALID_PAYLOAD',
            'Invalid editor:change payload.',
          )
          return
        }

        if (!(await enforceEventAccess(socket, payload.roomId, 'editor:change'))) {
          return
        }

        const currentState = await getOrLoadRoomFileState(payload.roomId, payload.docId)

        if (payload.baseVersion !== currentState.version) {
          socket.emit('room:state-sync', {
            roomId: payload.roomId,
            filePath: payload.docId,
            content: currentState.content,
            baseVersion: currentState.version,
          })
          return
        }

        const updatedState = applyEditorOperation(currentState.content, payload.op)
        if (!updatedState.ok) {
          socket.emit('room:state-sync', {
            roomId: payload.roomId,
            filePath: payload.docId,
            content: currentState.content,
            baseVersion: currentState.version,
          })
          return
        }

        const authenticatedUserId = socket.data.userId as number | undefined
        if (!authenticatedUserId || !Number.isSafeInteger(authenticatedUserId) || authenticatedUserId <= 0) {
          emitGatewayError(socket, 'editor:change', 'UNAUTHORIZED', 'Authenticated user is required.')
          return
        }

        const saved = await appendFileVersion({
          roomId: payload.roomId,
          filePath: payload.docId,
          content: updatedState.nextContent,
          updatedByUserId: authenticatedUserId,
          opId: payload.opId,
        })
        applySavedRowToState(saved.row)
        if (!saved.inserted) {
          return
        }

        io.to(payload.roomId).emit('editor:patch', {
          ...payload,
          baseVersion: saved.row.version - 1,
        })
      } catch (error) {
        console.error('[socket][editor:change] Failed to persist editor change:', error)
        emitGatewayError(socket, 'editor:change', 'INVALID_OPERATION', 'Failed to persist editor change.')
      }
    })

    socket.on('cursor:move', async (payload: unknown) => {
      if (!isCursorMovePayload(payload)) {
        emitGatewayError(socket, 'cursor:move', 'INVALID_PAYLOAD', 'Invalid cursor:move payload.')
        return
      }

      if (!(await enforceEventAccess(socket, payload.roomId, 'cursor:move'))) {
        return
      }

      socket.to(payload.roomId).emit('cursor:update', payload)
    })

    socket.on('ai:propose-block', async (payload: unknown) => {
      if (!isAiProposeBlockPayload(payload)) {
        emitGatewayError(
          socket,
          'ai:propose-block',
          'INVALID_PAYLOAD',
          'Invalid ai:propose-block payload.',
        )
        return
      }

      if (!(await enforceEventAccess(socket, payload.roomId, 'ai:propose-block'))) {
        return
      }

      io.to(payload.roomId).emit('ai:block-proposed', payload)
    })

    socket.on('ai:decision', async (payload: unknown) => {
      if (!isAiDecisionPayload(payload)) {
        emitGatewayError(socket, 'ai:decision', 'INVALID_PAYLOAD', 'Invalid ai:decision payload.')
        return
      }

      if (!(await enforceEventAccess(socket, payload.roomId, 'ai:decision'))) {
        return
      }

      io.to(payload.roomId).emit('ai:decision-applied', payload)
    })

    socket.on('terminal:stream', async (payload: unknown) => {
      if (!isTerminalStreamPayload(payload)) {
        emitGatewayError(
          socket,
          'terminal:stream',
          'INVALID_PAYLOAD',
          'Invalid terminal:stream payload.',
        )
        return
      }

      if (!(await enforceEventAccess(socket, payload.roomId, 'terminal:stream'))) {
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

    socket.on('code:execute', async (payload: unknown) => {
      if (!isCodeExecutePayload(payload)) {
        emitGatewayError(socket, 'code:execute', 'INVALID_PAYLOAD', 'Invalid code:execute payload.')
        return
      }

      if (!(await enforceEventAccess(socket, payload.roomId, 'terminal:stream'))) {
        return
      }

      const scanResult = scanCode(payload.source, payload.language)
      if (!scanResult.isSafe) {
        const message = buildChaosMessage(scanResult.type)
        socket.emit('security:chaos_detected', { type: scanResult.type, message })
        return
      }

      socket.emit('security:precheck_passed', { roomId: payload.roomId, ok: true })
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
