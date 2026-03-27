import { Router } from 'express'
import { probeDatabase } from '../services/database'

export const healthRoute = Router()

healthRoute.get('/health', async (_req, res, next) => {
  try {
    await probeDatabase()
    res.json({ status: 'ok', db: 'up' })
  } catch (error) {
    next(error)
  }
})
