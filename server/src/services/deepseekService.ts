import { config } from '../config'

type DeepSeekMessageContentPart = {
  type?: string
  text?: string
}

type DeepSeekChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | DeepSeekMessageContentPart[]
    }
  }>
  error?: {
    message?: string
  }
}

export type EditFileInput = {
  content: string
  instruction: string
  language: string
}

export class DeepSeekError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

function withNoTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

function unwrapCodeFence(content: string): string {
  const fencedMatch = content.match(/^```[^\n]*\n([\s\S]*?)\n```$/)
  if (!fencedMatch) {
    return content
  }

  return fencedMatch[1]
}

function extractMessageContent(data: DeepSeekChatResponse): string | null {
  const firstChoice = data.choices?.[0]
  const rawContent = firstChoice?.message?.content
  if (!rawContent) {
    return null
  }

  if (typeof rawContent === 'string') {
    return unwrapCodeFence(rawContent)
  }

  if (Array.isArray(rawContent)) {
    const combined = rawContent
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text ?? '')
      .join('')

    return unwrapCodeFence(combined)
  }

  return null
}

function getUpstreamErrorMessage(responseBody: unknown): string | null {
  if (!responseBody || typeof responseBody !== 'object') {
    return null
  }

  const maybeError = (responseBody as DeepSeekChatResponse).error
  if (!maybeError || typeof maybeError.message !== 'string') {
    return null
  }

  const message = maybeError.message.trim()
  return message.length > 0 ? message : null
}

export async function editFileWithDeepSeek(input: EditFileInput): Promise<string> {
  const apiKey = config.deepseek.apiKey.trim()
  if (!apiKey) {
    throw new DeepSeekError(500, 'DeepSeek API key is not configured')
  }

  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), config.deepseek.timeoutMs)
  let response: Response

  try {
    response = await fetch(`${withNoTrailingSlash(config.deepseek.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.deepseek.model,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'You are a coding assistant that edits a single file. Return only the full modified file content. Do not include markdown fences or explanations.',
          },
          {
            role: 'user',
            content: [
              `Language: ${input.language}`,
              'Instruction:',
              input.instruction,
              'Current file content:',
              input.content,
            ].join('\n'),
          },
        ],
      }),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new DeepSeekError(504, 'DeepSeek request timed out')
    }

    throw new DeepSeekError(502, 'Failed to reach DeepSeek API')
  } finally {
    clearTimeout(timeoutHandle)
  }

  const rawBody = await response.text()
  let parsedBody: unknown = null
  if (rawBody.trim().length > 0) {
    try {
      parsedBody = JSON.parse(rawBody)
    } catch {
      parsedBody = null
    }
  }

  if (!response.ok) {
    const upstreamMessage = getUpstreamErrorMessage(parsedBody)
    throw new DeepSeekError(
      502,
      upstreamMessage ? `DeepSeek API error: ${upstreamMessage}` : `DeepSeek API error: HTTP ${response.status}`,
    )
  }

  const modifiedContent = extractMessageContent((parsedBody ?? {}) as DeepSeekChatResponse)
  if (!modifiedContent || modifiedContent.trim().length === 0) {
    throw new DeepSeekError(502, 'DeepSeek returned empty or invalid modified content')
  }

  return modifiedContent
}
