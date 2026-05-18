import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ ok: false, error: 'Missing url query parameter' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid URL' }, { status: 400 })
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return NextResponse.json({ ok: false, error: 'Only http/https URLs are allowed' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4000)

  try {
    const start = Date.now()
    const response = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      cache: 'no-store',
    })
    const latencyMs = Date.now() - start
    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      latencyMs,
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ping failed' })
  } finally {
    clearTimeout(timeout)
  }
}
