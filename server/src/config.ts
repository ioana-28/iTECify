import dotenv from 'dotenv'

dotenv.config()

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid port value: ${value}`)
  }
  return parsed
}

function parseCorsOrigins(value: string | undefined): string[] {
  if (!value || value.trim() === '') {
    return ['http://localhost:5173', 'http://localhost:4173']
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGIN)

export const config = {
  host: process.env.HOST ?? '0.0.0.0',
  port: parsePort(process.env.PORT, 3001),
  corsOrigins,
  db: {
    host: process.env.DB_HOST ?? 'itecdb',
    port: parsePort(process.env.DB_PORT, 5432),
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'itec_db',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  },
}
