import { PrismaAdapter } from '@auth/prisma-adapter'
import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  trustHost: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
        const res = await fetch(`${apiUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: credentials.email, password: credentials.password }),
        })
        if (res.status === 403) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.message ?? 'Please verify your email before signing in.')
        }
        if (!res.ok) return null
        return res.json()
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    signIn: async ({ user }) => {
      // Promote the configured admin on every sign-in (Google + Credentials).
      const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()
      if (adminEmail && user.email?.toLowerCase() === adminEmail) {
        await prisma.user.updateMany({
          where: { email: user.email },
          data: { role: 'ADMIN', status: 'APPROVED' },
        }).catch(() => {
          // Swallow: token callback below still enforces admin claims.
        })
      }
      return true
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.sub = user.id
        if (user.email) token.email = user.email
      }

      // Enforce admin override on every sign-in AND every subsequent refresh.
      // This keeps admin rights alive regardless of DB state or session age.
      const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()
      let effectiveEmail = ((user?.email as string | undefined) ?? (token.email as string | undefined))?.toLowerCase()

      // Backfill token email if missing so admin checks remain stable on refresh.
      if (!effectiveEmail && token.sub) {
        try {
          const dbIdentity = await prisma.user.findUnique({
            where: { id: token.sub as string },
            select: { email: true },
          })
          if (dbIdentity?.email) {
            token.email = dbIdentity.email
            effectiveEmail = dbIdentity.email.toLowerCase()
          }
        } catch {
          // Ignore and continue with non-admin path.
        }
      }

      if (adminEmail && effectiveEmail === adminEmail) {
        token.status = 'APPROVED'
        token.role = 'ADMIN'
        return token
      }

      if (user) {
        // Initial sign-in: read role/status from DB for non-admin users
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { status: true, role: true },
          })
          token.status = dbUser?.status ?? 'PENDING'
          token.role = dbUser?.role ?? 'USER'
        } catch {
          // Avoid failing auth callback and bouncing back to /login if DB is unavailable.
          token.status = token.status ?? 'PENDING'
          token.role = token.role ?? 'USER'
        }
      } else if (token.status !== 'APPROVED' && token.sub) {
        // Token refresh: re-check so approved users aren't stuck as PENDING
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub as string },
            select: { status: true, role: true },
          })
          if (dbUser) {
            token.status = dbUser.status
            token.role = dbUser.role
          }
        } catch {
          // Keep existing token claims if DB cannot be reached.
        }
      }
      return token
    },
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub as string,
        status: token.status as string | undefined,
        role: token.role as string | undefined,
      },
    }),
  },
  pages: {
    signIn: '/login',
  },
}
