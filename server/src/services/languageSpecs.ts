import type { RunLanguage } from '../types'

export type LanguageSpec = {
  image: string
  sourceFile: string
  executionScript: string
}

export const languageSpecs: Record<RunLanguage, LanguageSpec> = {
  python: {
    image: 'python:3.13-alpine',
    sourceFile: 'main.py',
    executionScript: 'python /workspace/main.py',
  },
  node: {
    image: 'node:22-alpine',
    sourceFile: 'main.js',
    executionScript: 'node /workspace/main.js',
  },
  c: {
    image: 'gcc:14',
    sourceFile: 'main.c',
    executionScript: 'gcc /workspace/main.c -O2 -o /workspace/main && /workspace/main',
  },
  cpp: {
    image: 'gcc:14',
    sourceFile: 'main.cpp',
    executionScript: 'g++ /workspace/main.cpp -std=c++17 -O2 -o /workspace/main && /workspace/main',
  },
  rust: {
    image: 'rust:1.86',
    sourceFile: 'main.rs',
    executionScript: '/usr/local/cargo/bin/rustc /workspace/main.rs -O -o /workspace/main && /workspace/main',
  },
}
