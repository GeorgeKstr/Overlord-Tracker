import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'
import * as jose from 'jose'

const signingSecret = process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET

// Returns an API-compatible HS256 JWT for NestJS API Bearer auth.
export async function GET(request: NextRequest) {
  if (!signingSecret) {
    return NextResponse.json({ error: 'JWT_SECRET is not configured' }, { status: 500 })
  }

  const sessionToken = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET!,
  })

  if (!sessionToken?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = await new jose.SignJWT({
    email: typeof sessionToken.email === 'string' ? sessionToken.email : undefined,
    name: typeof sessionToken.name === 'string' ? sessionToken.name : undefined,
    picture: typeof sessionToken.picture === 'string' ? sessionToken.picture : undefined,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sessionToken.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode(signingSecret))

  return NextResponse.json({ token })
}
