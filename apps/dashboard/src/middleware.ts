import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Keep auth host consistent in local dev to avoid OAuth state cookie mismatches.
export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''

  if (host.startsWith('127.0.0.1:')) {
    const url = request.nextUrl.clone()
    url.hostname = 'localhost'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
