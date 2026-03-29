import { randomUUID } from 'node:crypto'
import { db } from './database'
import type { RoomRow } from './roomRepository'

export type ProjectRow = {
  id: string
  user_id: number
  room_id: string
  name: string
  primary_language: string
  tree_snapshot: string
  created_at: string
  updated_at: string
  last_opened_at: string
}

export type ProjectWithRoomRow = ProjectRow & {
  room_invite_code: string
}

type CreateProjectInput = {
  userId: number
  roomId: string
  name: string
  primaryLanguage: string
  treeSnapshot: string
}

type EnsureProjectForRoomInput = {
  userId: number
  room: RoomRow
  defaultTreeSnapshot?: string
}

function normalizeProjectName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Project name is required')
  }

  if (trimmed.length > 120) {
    throw new Error('Project name is too long')
  }

  return trimmed
}

function normalizePrimaryLanguage(language: string): string {
  const trimmed = language.trim().toLowerCase()
  if (!trimmed) {
    throw new Error('Primary language is required')
  }

  if (trimmed.length > 40) {
    throw new Error('Primary language is too long')
  }

  return trimmed
}

function normalizeTreeSnapshot(snapshot: string): string {
  if (snapshot.trim() === '') {
    return '{}'
  }

  try {
    const parsed = JSON.parse(snapshot)
    return JSON.stringify(parsed)
  } catch {
    throw new Error('treeSnapshot must be valid JSON')
  }
}

export async function ensureProjectsTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      primary_language TEXT NOT NULL,
      tree_snapshot JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, room_id)
    )
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_projects_user_recency
    ON projects (user_id, last_opened_at DESC, updated_at DESC)
  `)
}

export async function createProject(input: CreateProjectInput): Promise<ProjectRow> {
  const name = normalizeProjectName(input.name)
  const primaryLanguage = normalizePrimaryLanguage(input.primaryLanguage)
  const treeSnapshot = normalizeTreeSnapshot(input.treeSnapshot)

  const result = await db.query<ProjectRow>(
    `INSERT INTO projects (
       id, user_id, room_id, name, primary_language, tree_snapshot
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING
       id, user_id, room_id, name, primary_language, tree_snapshot::text,
       created_at, updated_at, last_opened_at`,
    [randomUUID(), input.userId, input.roomId, name, primaryLanguage, treeSnapshot],
  )

  const project = result.rows[0]
  if (!project) {
    throw new Error('Failed to create project')
  }

  return project
}

export async function touchProjectLastOpened(projectId: string, userId: number): Promise<void> {
  await db.query(
    `UPDATE projects
     SET last_opened_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [projectId, userId],
  )
}

export async function listRecentProjectsForUser(userId: number, limit = 3): Promise<ProjectWithRoomRow[]> {
  const result = await db.query<ProjectWithRoomRow>(
    `SELECT
       p.id,
       p.user_id,
       p.room_id,
       p.name,
       p.primary_language,
       p.tree_snapshot::text,
       p.created_at,
       p.updated_at,
       p.last_opened_at,
       r.invite_code AS room_invite_code
     FROM projects p
     INNER JOIN rooms r ON r.id = p.room_id
     WHERE p.user_id = $1
     ORDER BY p.last_opened_at DESC, p.updated_at DESC
     LIMIT $2`,
    [userId, limit],
  )

  return result.rows
}

export async function findProjectByIdForUser(projectId: string, userId: number): Promise<ProjectWithRoomRow | null> {
  const result = await db.query<ProjectWithRoomRow>(
    `SELECT
       p.id,
       p.user_id,
       p.room_id,
       p.name,
       p.primary_language,
       p.tree_snapshot::text,
       p.created_at,
       p.updated_at,
       p.last_opened_at,
       r.invite_code AS room_invite_code
     FROM projects p
     INNER JOIN rooms r ON r.id = p.room_id
     WHERE p.id = $1 AND p.user_id = $2
     LIMIT 1`,
    [projectId, userId],
  )

  return result.rows[0] ?? null
}

export async function findProjectByRoomAndUser(roomId: string, userId: number): Promise<ProjectRow | null> {
  const result = await db.query<ProjectRow>(
    `SELECT
       id, user_id, room_id, name, primary_language, tree_snapshot::text,
       created_at, updated_at, last_opened_at
     FROM projects
     WHERE room_id = $1 AND user_id = $2
     LIMIT 1`,
    [roomId, userId],
  )

  return result.rows[0] ?? null
}

export async function updateProjectTreeSnapshot(projectId: string, userId: number, treeSnapshot: string): Promise<void> {
  const normalizedSnapshot = normalizeTreeSnapshot(treeSnapshot)

  await db.query(
    `UPDATE projects
     SET tree_snapshot = $3::jsonb,
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [projectId, userId, normalizedSnapshot],
  )
}

export async function ensureProjectForJoinedRoom(input: EnsureProjectForRoomInput): Promise<ProjectRow> {
  const existing = await findProjectByRoomAndUser(input.room.id, input.userId)
  if (existing) {
    await touchProjectLastOpened(existing.id, input.userId)
    return existing
  }

  const defaultName = input.room.name?.trim() || `Project ${input.room.invite_code}`
  return createProject({
    userId: input.userId,
    roomId: input.room.id,
    name: defaultName,
    primaryLanguage: 'javascript',
    treeSnapshot: input.defaultTreeSnapshot ?? '{}',
  })
}
