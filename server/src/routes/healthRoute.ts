import { Router } from 'express'

export const healthRoute = Router()

healthRoute.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})
