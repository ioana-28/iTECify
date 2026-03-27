import cors from 'cors'
import express from 'express'
import { config } from './config'
import { executionRoute } from './routes/executionRoute'
import { healthRoute } from './routes/healthRoute'

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: config.corsOrigin,
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  app.use('/api', healthRoute)
  app.use('/api', executionRoute)

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: error.message })
  })

  return app
}
