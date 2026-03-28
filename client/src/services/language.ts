export function getLanguageFromPath(path: string): string {
  const normalized = path.toLowerCase()

  if (normalized.endsWith('.js') || normalized.endsWith('.jsx')) return 'javascript'
  if (normalized.endsWith('.css')) return 'css'
  if (normalized.endsWith('.json')) return 'json'
  if (normalized.endsWith('.html')) return 'html'
  if (normalized.endsWith('.md')) return 'markdown'
  if (normalized.endsWith('.py')) return 'python'
  if (normalized.endsWith('.rs')) return 'rust'
  if (normalized.endsWith('.c')) return 'c'
  if (normalized.endsWith('.cpp') || normalized.endsWith('.cc') || normalized.endsWith('.cxx')) return 'cpp'

  return 'plaintext'
}
