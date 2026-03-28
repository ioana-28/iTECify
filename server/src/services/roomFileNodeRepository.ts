import { db } from './database'

export type RoomFileNodeType = 'file' | 'folder'

export type RoomFileNodeRow = {
  room_id: string
  path: string
  name: string
  type: RoomFileNodeType
  parent_path: string | null
  created_by_user_id: number
  created_at: string
}

type CreateRoomFileNodeInput = {
  roomId: string
  name: string
  type: RoomFileNodeType
  parentPath?: string | null
  createdByUserId: number
}

function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function validateNodeName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Node name cannot be empty')
  }

  if (trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error('Node name cannot contain path separators')
  }

  if (trimmed === '.' || trimmed === '..') {
    throw new Error('Node name is invalid')
  }

  return trimmed
}

function buildPath(parentPath: string | null, name: string): string {
  if (!parentPath) {
    return name
  }
  return `${parentPath}/${name}`
}

export async function ensureRoomFileNodeTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS room_file_nodes (
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('file', 'folder')),
      parent_path TEXT,
      created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (room_id, path)
    )
  `)

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_room_file_nodes_room_parent_name
    ON room_file_nodes (room_id, COALESCE(parent_path, ''), name)
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_room_file_nodes_room_parent
    ON room_file_nodes (room_id, parent_path)
  `)
}

export async function listRoomFileNodes(roomId: string): Promise<RoomFileNodeRow[]> {
  const result = await db.query<RoomFileNodeRow>(
    `SELECT room_id, path, name, type, parent_path, created_by_user_id, created_at
     FROM room_file_nodes
     WHERE room_id = $1
     ORDER BY path ASC`,
    [roomId],
  )

  return result.rows
}

export async function getRoomFileNode(roomId: string, path: string): Promise<RoomFileNodeRow | null> {
  const normalizedPath = normalizePath(path)
  const result = await db.query<RoomFileNodeRow>(
    `SELECT room_id, path, name, type, parent_path, created_by_user_id, created_at
     FROM room_file_nodes
     WHERE room_id = $1 AND path = $2
     LIMIT 1`,
    [roomId, normalizedPath],
  )

  return result.rows[0] ?? null
}

export async function createRoomFileNode(input: CreateRoomFileNodeInput): Promise<RoomFileNodeRow> {
  const name = validateNodeName(input.name)
  const parentPath = input.parentPath && input.parentPath.trim() ? normalizePath(input.parentPath) : null
  const path = buildPath(parentPath, name)

  if (parentPath) {
    const parentNode = await getRoomFileNode(input.roomId, parentPath)
    if (!parentNode) {
      throw new Error('Parent folder does not exist')
    }

    if (parentNode.type !== 'folder') {
      throw new Error('Parent path must reference a folder')
    }
  }

  const result = await db.query<RoomFileNodeRow>(
    `INSERT INTO room_file_nodes (
       room_id, path, name, type, parent_path, created_by_user_id
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING room_id, path, name, type, parent_path, created_by_user_id, created_at`,
    [input.roomId, path, name, input.type, parentPath, input.createdByUserId],
  )

  const created = result.rows[0]
  if (!created) {
    throw new Error('Failed to create file node')
  }

  return created
}
