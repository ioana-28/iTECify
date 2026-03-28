import cors from 'cors'
import express from 'express'
import { aiRoute } from './routes/aiRoute'
import { config } from './config'
import { authRoute } from './routes/authRoute'
import { executionRoute } from './routes/executionRoute'
import { healthRoute } from './routes/healthRoute'
import { roomRoute } from './routes/roomRoute'

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: config.corsOrigins,
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  app.use('/api', healthRoute)
  app.use('/api', executionRoute)
  app.use('/api/auth', authRoute)
  app.use('/api/ai', aiRoute)
  app.use('/api', roomRoute)

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: error.message })
  })

  return app
}
