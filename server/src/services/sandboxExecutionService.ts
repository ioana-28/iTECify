import Docker from 'dockerode'
import tar from 'tar-stream'
import { randomUUID } from 'node:crypto'
import { config } from '../config'
import type { ExecutionSessionEvent, RunCodeRequest } from '../types'
import { executionSessionStore } from './executionSessionStore'
import { languageSpecs } from './languageSpecs'
import { scanSourceForRisks } from './vulnerabilityScanner'

const docker = new Docker()
const EXECUTION_TIMEOUT_MS = config.execution.timeoutMs

function nowIso(): string {
  return new Date().toISOString()
}

function emit(sessionId: string, event: Omit<ExecutionSessionEvent, 'timestamp'>): void {
  executionSessionStore.addEvent(sessionId, {
    ...event,
    timestamp: nowIso(),
  })
}

export class SandboxExecutionService {
  private readonly activeContainers = new Map<string, Docker.Container>()

  startExecution(request: RunCodeRequest): string {
    const sessionId = randomUUID()
    executionSessionStore.createSession(sessionId)
    this.executeAsync(sessionId, request).catch((error) => {
      emit(sessionId, { type: 'error', message: error.message })
      emit(sessionId, { type: 'complete', message: 'Execution failed.', exitCode: 1 })
      executionSessionStore.completeSession(sessionId)
    })
    return sessionId
  }

  stopExecution(sessionId: string): boolean {
    const container = this.activeContainers.get(sessionId)
    if (!container) {
      return false
    }

    this.activeContainers.delete(sessionId)

    container
      .kill()
      .catch(() => undefined)
      .finally(() => {
        emit(sessionId, { type: 'status', message: 'Execution stopped by user.' })
        emit(sessionId, { type: 'complete', message: 'Execution stopped.', exitCode: 130 })
        executionSessionStore.completeSession(sessionId)
      })

    return true
  }

  private async executeAsync(sessionId: string, request: RunCodeRequest): Promise<void> {
    const spec = languageSpecs[request.language]
    if (!spec) {
      throw new Error(`Unsupported language: ${request.language}`)
    }

    emit(sessionId, { type: 'scan', message: 'Running vulnerability scan hook...' })
    const scanResult = scanSourceForRisks(request.source)
    if (scanResult.blocked) {
      emit(sessionId, { type: 'error', message: scanResult.summary })
      emit(sessionId, { type: 'complete', message: 'Execution blocked by scan.', exitCode: 1 })
      executionSessionStore.completeSession(sessionId)
      return
    }
    emit(sessionId, { type: 'scan', message: scanResult.summary })

    let container: Docker.Container | null = null
    try {
      emit(sessionId, { type: 'status', message: `Preparing Docker image ${spec.image}...` })
      await this.ensureImage(spec.image)

      emit(sessionId, { type: 'status', message: `Creating isolated ${request.language} container...` })
      if (request.stepMode) {
        emit(
          sessionId,
          {
            type: 'status',
            message:
              'Step mode is currently simulated per output event; using protected timed execution in sandbox.',
          },
        )
      }
      container = await docker.createContainer({
        Image: spec.image,
        Cmd: ['sh', '-lc', `${spec.executionScript} < /workspace/stdin.txt`],
        WorkingDir: '/workspace',
        HostConfig: {
          AutoRemove: false,
          Memory: 256 * 1024 * 1024,
          NanoCpus: 1_000_000_000,
          PidsLimit: 128,
          SecurityOpt: ['no-new-privileges:true'],
          NetworkMode: 'none',
        },
      })

      const archive = await this.createWorkspaceArchive(spec.sourceFile, request.source, request.stdin ?? '')
      await container.putArchive(archive, { path: '/workspace' })

      emit(sessionId, { type: 'status', message: 'Starting container...' })
      await container.start()
      this.activeContainers.set(sessionId, container)

      // Stream logs in real-time
      const logsPromise = container.logs({
        stdout: true,
        stderr: true,
        follow: true,
        timestamps: false,
      })

      const logs = await logsPromise
      const streamTask = this.streamLogs(sessionId, logs)
      const waitResult = await this.waitWithTimeout(container, EXECUTION_TIMEOUT_MS)
      await streamTask

      emit(sessionId, {
        type: 'complete',
        message: waitResult.StatusCode === 0 ? 'Execution completed.' : 'Execution finished with errors.',
        exitCode: waitResult.StatusCode ?? 1,
      })
      executionSessionStore.completeSession(sessionId)
    } finally {
      this.activeContainers.delete(sessionId)
      if (container) {
        emit(sessionId, { type: 'status', message: 'Cleaning up container...' })
        try {
          await container.remove({ force: true })
        } catch {
          // ignore cleanup races
        }
      }
    }
  }

  private async ensureImage(image: string): Promise<void> {
    try {
      await docker.getImage(image).inspect()
      return
    } catch {
      const stream = await docker.pull(image)
      await new Promise<void>((resolve, reject) => {
        docker.modem.followProgress(stream, (error: Error | null) => {
          if (error) reject(error)
          else resolve()
        })
      })
    }
  }

  private createWorkspaceArchive(sourceName: string, sourceCode: string, stdin: string): Promise<Buffer> {
    const pack = tar.pack()
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      pack.on('data', (chunk: Buffer) => chunks.push(chunk))
      pack.on('error', reject)
      pack.on('end', () => resolve(Buffer.concat(chunks)))
      pack.entry({ name: sourceName, mode: 0o644 }, sourceCode)
      pack.entry({ name: 'stdin.txt', mode: 0o644 }, stdin)
      pack.finalize()
    })
  }

  private async collectLogs(container: Docker.Container): Promise<{ stdoutLines: string[]; stderrLines: string[] }> {
    const raw = (await container.logs({
      stdout: true,
      stderr: true,
      follow: false,
      timestamps: false,
    })) as Buffer

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let offset = 0

    while (offset + 8 <= raw.length) {
      const streamType = raw.readUInt8(offset)
      const frameSize = raw.readUInt32BE(offset + 4)
      const start = offset + 8
      const end = start + frameSize
      if (end > raw.length) break
      const chunk = raw.subarray(start, end)
      if (streamType === 1) stdoutChunks.push(chunk)
      else stderrChunks.push(chunk)
      offset = end
    }

    const splitLines = (buffer: Buffer) =>
      buffer
        .toString('utf8')
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0)

    return {
      stdoutLines: splitLines(Buffer.concat(stdoutChunks)),
      stderrLines: splitLines(Buffer.concat(stderrChunks)),
    }
  }

  private async streamLogs(sessionId: string, logs: NodeJS.ReadableStream): Promise<void> {
    return new Promise((resolve) => {
      const stdoutBuffer: Buffer[] = []
      const stderrBuffer: Buffer[] = []
      let lastStdoutLength = 0
      let lastStderrLength = 0
      let pending = Buffer.alloc(0)

      logs.on('data', (chunk: Buffer) => {
        // Docker logs use 8-byte headers: [streamType(1), reserved(3), length(4)]
        pending = Buffer.concat([pending, chunk])
        while (pending.length >= 8) {
          const streamType = pending.readUInt8(0)
          const frameSize = pending.readUInt32BE(4)
          if (pending.length < 8 + frameSize) {
            break
          }

          const payload = pending.subarray(8, 8 + frameSize)

          if (streamType === 1) {
            stdoutBuffer.push(payload)
            const newStdout = Buffer.concat(stdoutBuffer).toString('utf8')
            const newLines = newStdout.slice(lastStdoutLength).split(/\r?\n/)
            for (const line of newLines) {
              if (line.trim().length > 0) {
                emit(sessionId, { type: 'stdout', message: line })
              }
            }
            lastStdoutLength = newStdout.length
          } else if (streamType === 2) {
            stderrBuffer.push(payload)
            const newStderr = Buffer.concat(stderrBuffer).toString('utf8')
            const newLines = newStderr.slice(lastStderrLength).split(/\r?\n/)
            for (const line of newLines) {
              if (line.trim().length > 0) {
                emit(sessionId, { type: 'stderr', message: line })
              }
            }
            lastStderrLength = newStderr.length
          }

          pending = pending.subarray(8 + frameSize)
        }
      })

      logs.on('end', () => {
        resolve()
      })

      logs.on('error', () => {
        resolve()
      })
    })
  }

  private async waitWithTimeout(
    container: Docker.Container,
    timeoutMs: number,
  ): Promise<{ StatusCode?: number }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(async () => {
        try {
          await container.kill()
        } catch {
          // ignore
        }
        reject(new Error(`Execution timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      container
        .wait()
        .then((result) => {
          clearTimeout(timeout)
          resolve(result as { StatusCode?: number })
        })
        .catch((error) => {
          clearTimeout(timeout)
          reject(error)
        })
    })
  }
}
