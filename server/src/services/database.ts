import { Pool } from 'pg'
import { config } from '../config'

// Create a connection pool using the config we just updated
export const db = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
})

// Quick check to confirm connection on startup
db.on('connect', () => {
  console.log('Connected to itec_db successfully')
})

db.on('error', (err) => {
  console.error('Unexpected error on idle database client', err)
})

export async function probeDatabase(): Promise<void> {
  await db.query('SELECT 1')
}
