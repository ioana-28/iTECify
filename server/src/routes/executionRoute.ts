import { Router } from 'express'
import type { RunCodeRequest, StartExecutionResponse } from '../types'
import { executionSessionStore } from '../services/executionSessionStore'
import { SandboxExecutionService } from '../services/sandboxExecutionService'

export const executionRoute = Router()
const executionService = new SandboxExecutionService()

executionRoute.post('/execute', (req, res, next) => {
  try {
    const body = req.body as Partial<RunCodeRequest>
    if (!body.language || typeof body.language !== 'string' || !body.source || typeof body.source !== 'string') {
      res.status(400).json({ error: 'language and source are required' })
      return
    }

    if (
      body.language !== 'node' &&
      body.language !== 'python' &&
      body.language !== 'c' &&
      body.language !== 'cpp' &&
      body.language !== 'rust'
    ) {
      res.status(400).json({ error: 'language must be one of: node, python, c, cpp, rust' })
      return
    }

    const sessionId = executionService.startExecution({
      language: body.language,
      source: body.source,
      stdin: body.stdin,
      stepMode: Boolean(body.stepMode),
    })

    const response: StartExecutionResponse = { sessionId }
    res.status(202).json(response)
  } catch (error) {
    next(error)
  }
})

executionRoute.post('/execute/:sessionId/stop', (req, res) => {
  const { sessionId } = req.params
  const state = executionSessionStore.getState(sessionId)
  if (!state) {
    res.status(404).json({ error: 'Execution session not found' })
    return
  }

  if (state.isCompleted) {
    res.status(409).json({ error: 'Execution already completed' })
    return
  }

  const stopped = executionService.stopExecution(sessionId)
  if (!stopped) {
    res.status(409).json({ error: 'Execution is not running' })
    return
  }

  res.status(202).json({ sessionId, status: 'stopping' })
})

executionRoute.get('/execute/:sessionId/stream', (req, res) => {
  const { sessionId } = req.params
  const state = executionSessionStore.getState(sessionId)
  if (!state) {
    res.status(404).json({ error: 'Execution session not found' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const push = (event: unknown) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  for (const event of state.events) {
    push(event)
  }

  if (state.isCompleted) {
    res.end()
    return
  }

  const unsubscribe = executionSessionStore.subscribe(sessionId, (event) => {
    push(event)
    if (event.type === 'complete') {
      unsubscribe?.()
      res.end()
    }
  })

  req.on('close', () => {
    unsubscribe?.()
  })
})
