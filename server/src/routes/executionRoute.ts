import { Router } from 'express'
import type { RunCodeRequest } from '../types'
import { ExecutionService } from '../services/executionService'

export const executionRoute = Router()
const executionService = new ExecutionService()

executionRoute.post('/execute', async (req, res, next) => {
  try {
    const body = req.body as Partial<RunCodeRequest>
    if (!body.language || typeof body.language !== 'string' || !body.source || typeof body.source !== 'string') {
      res.status(400).json({ error: 'language and source are required' })
      return
    }

    if (body.language !== 'node' && body.language !== 'python' && body.language !== 'cpp') {
      res.status(400).json({ error: 'language must be one of: node, python, cpp' })
      return
    }

    const result = await executionService.runCode({
      language: body.language,
      source: body.source,
      stdin: body.stdin,
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
})
