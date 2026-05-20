const STORAGE_KEY = 'overlord.baseUrl'

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

export function getDefaultOverlordBaseUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  const normalized = trimTrailingSlash(apiUrl)
  return normalized.endsWith('/api') ? normalized.slice(0, -4) : normalized
}

export function normalizeOverlordBaseUrl(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  const normalized = trimTrailingSlash(trimmed)
  return normalized.endsWith('/api') ? normalized.slice(0, -4) : normalized
}

export function getStoredOverlordBaseUrl() {
  if (typeof window === 'undefined') return getDefaultOverlordBaseUrl()
  return normalizeOverlordBaseUrl(localStorage.getItem(STORAGE_KEY) ?? '') || getDefaultOverlordBaseUrl()
}

export function setStoredOverlordBaseUrl(value: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, normalizeOverlordBaseUrl(value))
  window.dispatchEvent(new Event('overlord-base-url-changed'))
}

export function buildSchemaApiUrl(baseUrl: string) {
  return `${trimTrailingSlash(baseUrl)}/docs-json`
}

export function buildProjectApiUrl(baseUrl: string, projectId: string) {
  return `${trimTrailingSlash(baseUrl)}/api/projects/${projectId}/context`
}

export function formatContextApiUrl(url: string, maxLength = 58) {
  const compact = url.replace(/^https?:\/\//, '')
  if (compact.length <= maxLength) return compact

  const head = compact.slice(0, Math.max(20, maxLength - 18))
  const tail = compact.slice(-12)
  return `${head}...${tail}`
}
