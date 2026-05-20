function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3001'
  throw new Error('NEXT_PUBLIC_API_URL is not configured for production')
}

async function getApiToken(): Promise<string> {
  const res = await fetch('/api/auth/token')
  if (!res.ok) throw new Error('Not authenticated')
  const { token } = (await res.json()) as { token: string }
  return token
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const apiBase = getApiBase()
  const token = await getApiToken()
  let res: Response
  try {
    res = await fetch(`${apiBase}/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })
  } catch {
    throw new Error(`Cannot reach API at ${apiBase}. Check NEXT_PUBLIC_API_URL and API CORS settings.`)
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(
      (error as { message?: string }).message ?? 'API request failed',
    )
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => apiFetch<void>(path, { method: 'DELETE' }),
}
