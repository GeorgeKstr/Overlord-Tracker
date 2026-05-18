import { NextResponse } from 'next/server'

const COOKIE_NAMES = [
  'next-auth.csrf-token',
  '__Host-next-auth.csrf-token',
  '__Secure-next-auth.csrf-token',
  'next-auth.callback-url',
  '__Secure-next-auth.callback-url',
  'next-auth.state',
  '__Secure-next-auth.state',
  'next-auth.pkce.code_verifier',
  '__Secure-next-auth.pkce.code_verifier',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
]

export async function POST() {
  const response = NextResponse.json({ ok: true })

  for (const name of COOKIE_NAMES) {
    response.cookies.set({
      name,
      value: '',
      path: '/',
      maxAge: 0,
    })
  }

  return response
}
