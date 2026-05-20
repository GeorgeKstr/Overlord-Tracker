import { NextRequest, NextResponse } from 'next/server'

function getApiBaseUrl() {
  const value =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '')

  return value.replace(/\/+$/, '')
}

function getTargetUrl(request: NextRequest, path: string[]) {
  const baseUrl = getApiBaseUrl()
  if (!baseUrl) return ''

  const joinedPath = path.join('/')
  const search = request.nextUrl.search || ''
  return `${baseUrl}/api/${joinedPath}${search}`
}

async function forward(request: NextRequest, path: string[]) {
  const targetUrl = getTargetUrl(request, path)
  if (!targetUrl) {
    return NextResponse.json(
      { message: 'API_URL is not configured on dashboard service.' },
      { status: 500 },
    )
  }

  const method = request.method
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text()

  const upstream = await fetch(targetUrl, {
    method,
    headers: {
      'content-type': request.headers.get('content-type') ?? 'application/json',
      authorization: request.headers.get('authorization') ?? '',
    },
    body,
    cache: 'no-store',
  })

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return forward(request, params.path)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return forward(request, params.path)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return forward(request, params.path)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return forward(request, params.path)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return forward(request, params.path)
}
