export type RunLanguage = 'node' | 'python' | 'cpp'

export type RunCodeRequest = {
  language: RunLanguage
  source: string
  stdin?: string
}

export type RunCodeResult = {
  language: RunLanguage
  output: string
  exitCode: number
}
