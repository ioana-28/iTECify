import { db } from './database'

export type RoomFileVersionRow = {
  room_id: string
  file_path: string
  version: number
  content: string
  updated_by_user_id: number
  op_id: string
  created_at: string
}

export type AppendFileVersionInput = {
  roomId: string
  filePath: string
  content: string
  updatedByUserId: number
  opId: string
}

type AppendFileVersionResult = {
  row: RoomFileVersionRow
  inserted: boolean
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const dbError = error as { code?: string; constraint?: string }
  return dbError.code === '23505' && dbError.constraint === constraint
}

export async function ensureRoomFileVersionTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS room_file_versions (
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      version INTEGER NOT NULL CHECK (version > 0),
      content TEXT NOT NULL,
      updated_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      op_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (room_id, file_path, version),
      UNIQUE (room_id, file_path, op_id)
    )
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_room_file_versions_lookup
    ON room_file_versions (room_id, file_path, version DESC)
  `)
}

export async function getLatestFileVersion(
  roomId: string,
  filePath: string,
): Promise<RoomFileVersionRow | null> {
  const result = await db.query<RoomFileVersionRow>(
    `SELECT room_id, file_path, version, content, updated_by_user_id, op_id, created_at
     FROM room_file_versions
     WHERE room_id = $1 AND file_path = $2
     ORDER BY version DESC
     LIMIT 1`,
    [roomId, filePath],
  )

  return result.rows[0] ?? null
}

async function getFileVersionByOpId(roomId: string, filePath: string, opId: string): Promise<RoomFileVersionRow | null> {
  const result = await db.query<RoomFileVersionRow>(
    `SELECT room_id, file_path, version, content, updated_by_user_id, op_id, created_at
     FROM room_file_versions
     WHERE room_id = $1 AND file_path = $2 AND op_id = $3
     LIMIT 1`,
    [roomId, filePath, opId],
  )

  return result.rows[0] ?? null
}

export async function appendFileVersion(input: AppendFileVersionInput): Promise<AppendFileVersionResult> {
  const maxAttempts = 5

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const client = await db.connect()
    try {
      await client.query('BEGIN')

      const existingByOp = await client.query<RoomFileVersionRow>(
        `SELECT room_id, file_path, version, content, updated_by_user_id, op_id, created_at
         FROM room_file_versions
         WHERE room_id = $1 AND file_path = $2 AND op_id = $3
         LIMIT 1`,
        [input.roomId, input.filePath, input.opId],
      )
      const alreadySaved = existingByOp.rows[0]
      if (alreadySaved) {
        await client.query('COMMIT')
        return { row: alreadySaved, inserted: false }
      }

      const latest = await client.query<{ version: number }>(
        `SELECT version
         FROM room_file_versions
         WHERE room_id = $1 AND file_path = $2
         ORDER BY version DESC
         LIMIT 1`,
        [input.roomId, input.filePath],
      )
      const nextVersion = (latest.rows[0]?.version ?? 0) + 1

      const inserted = await client.query<RoomFileVersionRow>(
        `INSERT INTO room_file_versions (
           room_id, file_path, version, content, updated_by_user_id, op_id
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING room_id, file_path, version, content, updated_by_user_id, op_id, created_at`,
        [input.roomId, input.filePath, nextVersion, input.content, input.updatedByUserId, input.opId],
      )
      const row = inserted.rows[0]
      if (!row) {
        throw new Error('Failed to append room file version')
      }

      await client.query('COMMIT')
      return { row, inserted: true }
    } catch (error) {
      await client.query('ROLLBACK')

      if (isUniqueViolation(error, 'room_file_versions_room_id_file_path_op_id_key')) {
        const existing = await getFileVersionByOpId(input.roomId, input.filePath, input.opId)
        if (!existing) {
          throw error
        }
        return { row: existing, inserted: false }
      }

      if (isUniqueViolation(error, 'room_file_versions_pkey')) {
        continue
      }

      throw error
    } finally {
      client.release()
    }
  }

  throw new Error('Failed to append room file version after multiple retries')
}
