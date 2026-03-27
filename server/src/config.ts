import dotenv from 'dotenv'

dotenv.config()

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid port value: ${value}`)
  }

  return parsed
}

export const config = {
  host: process.env.HOST ?? '0.0.0.0',
  port: parsePort(process.env.PORT, 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
}
