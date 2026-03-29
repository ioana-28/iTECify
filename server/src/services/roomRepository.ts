import { randomBytes, randomUUID } from 'node:crypto'
import { db } from './database'

export type RoomRow = {
  id: string
  owner_user_id: number
  name: string | null
  invite_code: string
  created_at: string
}

export type RoomMembershipRow = {
  room_id: string
  user_id: number
  role: 'owner' | 'member'
  joined_at: string
}

function generateInviteCode(): string {
  return randomBytes(5).toString('hex').toUpperCase()
}

function isInviteCodeConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const dbError = error as { code?: string; constraint?: string }
  return dbError.code === '23505' && dbError.constraint === 'rooms_invite_code_key'
}

export async function ensureCollaborationTables(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT,
      invite_code TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS room_memberships (
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (room_id, user_id)
    )
  `)
}

export async function createRoom(ownerUserId: number, name?: string): Promise<RoomRow> {
  const client = await db.connect()

  try {
    await client.query('BEGIN')

    let createdRoom: RoomRow | null = null
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const result = await client.query<RoomRow>(
          `INSERT INTO rooms (id, owner_user_id, name, invite_code)
           VALUES ($1, $2, $3, $4)
           RETURNING id, owner_user_id, name, invite_code, created_at`,
          [randomUUID(), ownerUserId, name?.trim() || null, generateInviteCode()],
        )
        createdRoom = result.rows[0] ?? null
        break
      } catch (error) {
        if (!isInviteCodeConflict(error)) {
          throw error
        }
      }
    }

    if (!createdRoom) {
      throw new Error('Failed to allocate a unique invite code for room creation')
    }

    await client.query(
      `INSERT INTO room_memberships (room_id, user_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (room_id, user_id) DO NOTHING`,
      [createdRoom.id, ownerUserId],
    )

    await client.query('COMMIT')
    return createdRoom
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function findRoomByInviteCode(code: string): Promise<RoomRow | null> {
  const result = await db.query<RoomRow>(
    `SELECT id, owner_user_id, name, invite_code, created_at
     FROM rooms
     WHERE invite_code = $1`,
    [code.trim().toUpperCase()],
  )

  return result.rows[0] ?? null
}

export async function addMember(roomId: string, userId: number): Promise<RoomMembershipRow> {
  await db.query(
    `INSERT INTO room_memberships (room_id, user_id, role)
      VALUES ($1, $2, 'member')
     ON CONFLICT (room_id, user_id) DO UPDATE
     SET joined_at = NOW()`,
    [roomId, userId],
  )

  const result = await db.query<RoomMembershipRow>(
    `SELECT room_id, user_id, role, joined_at
     FROM room_memberships
     WHERE room_id = $1 AND user_id = $2`,
    [roomId, userId],
  )

  const membership = result.rows[0]
  if (!membership) {
    throw new Error('Failed to add or load room membership')
  }

  return membership
}

export async function isMember(roomId: string, userId: number): Promise<boolean> {
  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1
       FROM room_memberships
       WHERE room_id = $1 AND user_id = $2
     ) AS exists`,
    [roomId, userId],
  )

  return result.rows[0]?.exists ?? false
}

export async function listRoomsForUser(userId: number): Promise<RoomRow[]> {
  const result = await db.query<RoomRow>(
    `SELECT r.id, r.owner_user_id, r.name, r.invite_code, r.created_at
     FROM rooms r
     INNER JOIN room_memberships rm ON rm.room_id = r.id
     WHERE rm.user_id = $1
     ORDER BY rm.joined_at DESC`,
    [userId],
  )

  return result.rows
}

export async function getRoomById(roomId: string): Promise<RoomRow | null> {
  const result = await db.query<RoomRow>(
    `SELECT id, owner_user_id, name, invite_code, created_at
     FROM rooms
     WHERE id = $1`,
    [roomId],
  )

  return result.rows[0] ?? null
}
