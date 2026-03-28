import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware'
import { DeepSeekError, editFileWithDeepSeek } from '../services/deepseekService'

type EditFileRequest = {
  content: string
  instruction: string
  language: string
}

export const aiRoute = Router()

aiRoute.use(requireAuth)

aiRoute.post('/edit-file', async (req, res, next) => {
  try {
    const body = req.body as Partial<EditFileRequest>
    const content = body.content
    const instruction = body.instruction
    const language = body.language

    if (typeof content !== 'string') {
      res.status(400).json({ error: 'content is required and must be a string' })
      return
    }

    if (typeof instruction !== 'string' || instruction.trim().length === 0) {
      res.status(400).json({ error: 'instruction is required and must be a non-empty string' })
      return
    }

    if (typeof language !== 'string' || language.trim().length === 0) {
      res.status(400).json({ error: 'language is required and must be a non-empty string' })
      return
    }

    const modifiedContent = await editFileWithDeepSeek({
      content,
      instruction: instruction.trim(),
      language: language.trim(),
    })

    res.status(200).json({ content: modifiedContent })
  } catch (error) {
    if (error instanceof DeepSeekError) {
      res.status(error.statusCode).json({ error: error.message })
      return
    }

    next(error)
  }
})
