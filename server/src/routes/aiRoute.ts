import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware'
import { DeepSeekError, editFileWithDeepSeek } from '../services/deepseekService'

type EditFileRequest = {
  content: string
  instruction: string
  language: string
}

type DiffChunkType = 'added' | 'removed' | 'modified'

type DiffChunk = {
  id: string
  type: DiffChunkType
  oldStartLine: number
  oldEndLine: number
  newStartLine: number
  newEndLine: number
  oldLines: string[]
  newLines: string[]
}

function toLines(content: string): string[] {
  return content.split(/\r?\n/)
}

function findClosestAlignment(oldLines: string[], newLines: string[], oldStart: number, newStart: number): { oldIndex: number; newIndex: number } | null {
  const window = 40
  const oldLimit = Math.min(oldLines.length, oldStart + window)
  const newLimit = Math.min(newLines.length, newStart + window)

  let best: { oldIndex: number; newIndex: number; distance: number } | null = null

  for (let i = oldStart; i < oldLimit; i += 1) {
    for (let j = newStart; j < newLimit; j += 1) {
      if (oldLines[i] !== newLines[j]) {
        continue
      }

      const distance = (i - oldStart) + (j - newStart)
      if (!best || distance < best.distance) {
        best = { oldIndex: i, newIndex: j, distance }
      }
      break
    }
  }

  if (!best) {
    return null
  }

  return { oldIndex: best.oldIndex, newIndex: best.newIndex }
}

function buildLineDiffChunks(previousContent: string, nextContent: string): DiffChunk[] {
  const oldLines = toLines(previousContent)
  const newLines = toLines(nextContent)

  const chunks: DiffChunk[] = []
  let oldIndex = 0
  let newIndex = 0
  let chunkCounter = 1

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex < oldLines.length && newIndex < newLines.length && oldLines[oldIndex] === newLines[newIndex]) {
      oldIndex += 1
      newIndex += 1
      continue
    }

    const alignment = findClosestAlignment(oldLines, newLines, oldIndex, newIndex)
    const nextOldIndex = alignment ? alignment.oldIndex : oldLines.length
    const nextNewIndex = alignment ? alignment.newIndex : newLines.length

    const removed = oldLines.slice(oldIndex, nextOldIndex)
    const added = newLines.slice(newIndex, nextNewIndex)

    if (removed.length > 0 || added.length > 0) {
      const oldStartLine = oldIndex + 1
      const newStartLine = newIndex + 1
      const oldEndLine = removed.length > 0 ? oldStartLine + removed.length - 1 : oldStartLine - 1
      const newEndLine = added.length > 0 ? newStartLine + added.length - 1 : newStartLine - 1

      const type: DiffChunkType =
        removed.length === 0 ? 'added' : added.length === 0 ? 'removed' : 'modified'

      chunks.push({
        id: `chunk-${chunkCounter}`,
        type,
        oldStartLine,
        oldEndLine,
        newStartLine,
        newEndLine,
        oldLines: removed,
        newLines: added,
      })
      chunkCounter += 1
    }

    oldIndex = nextOldIndex
    newIndex = nextNewIndex
  }

  return chunks
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

    const chunks = buildLineDiffChunks(content, modifiedContent)

    res.status(200).json({ content: modifiedContent, chunks })
  } catch (error) {
    if (error instanceof DeepSeekError) {
      res.status(error.statusCode).json({ error: error.message })
      return
    }

    next(error)
  }
})
