import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Keep auth host consistent in local dev to avoid OAuth state cookie mismatches.
export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''

  if (host.startsWith('127.0.0.1:')) {
    const url = request.nextUrl.clone()
    url.hostname = 'localhost'
    return NextResponse.redirect(url)
  }

  const { pathname } = request.nextUrl

  // Skip static assets and auth routes
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/pending') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/ping') ||
    pathname.startsWith('/_next')

  if (isPublic) return NextResponse.next()

  // If there is a session but the user is not yet approved, send them to /pending
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (token && token.status !== 'APPROVED') {
    return NextResponse.redirect(new URL('/pending', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
