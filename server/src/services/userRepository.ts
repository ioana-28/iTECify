import { db } from './database'

export type UserRow = {
  id: number
  name: string
  last_name: string
  email: string
  password_hash: string
}

export async function ensureUsersTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await db.query<UserRow>(
    `SELECT id, name, last_name, email, password_hash
     FROM users
     WHERE email = $1`,
    [email],
  )

  return result.rows[0] ?? null
}

export async function createUser(params: {
  name: string
  lastName: string
  email: string
  passwordHash: string
}): Promise<UserRow> {
  const result = await db.query<UserRow>(
    `INSERT INTO users (name, last_name, email, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, last_name, email, password_hash`,
    [params.name, params.lastName, params.email, params.passwordHash],
  )

  const user = result.rows[0]
  if (!user) {
    throw new Error('Failed to create user')
  }

  return user
}
