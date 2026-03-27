import type { RunCodeRequest, RunCodeResult } from '../types'

export class ExecutionService {
  async runCode(request: RunCodeRequest): Promise<RunCodeResult> {
    const summary = [
      `language=${request.language}`,
      `sourceLength=${request.source.length}`,
      request.stdin ? `stdinLength=${request.stdin.length}` : 'stdinLength=0',
    ].join(', ')

    return {
      language: request.language,
      output: `Runner placeholder accepted request (${summary}).`,
      exitCode: 0,
    }
  }
}
