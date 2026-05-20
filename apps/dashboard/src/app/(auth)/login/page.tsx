'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Chrome, CheckCircle2 } from 'lucide-react'
import { OvLogo } from '@/components/logo'

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const verified = searchParams.get('verified') === 'true'
  const verificationFailed = searchParams.get('error') === 'verification-failed'

  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isCredSigningIn, setIsCredSigningIn] = useState(false)
  const [credError, setCredError] = useState<string | null>(null)

  useEffect(() => {
    if (session) router.push('/projects')
  }, [session, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    )
  }

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setCredError(null)
    setIsCredSigningIn(true)
    const res = await signIn('credentials', { email, password, redirect: false })
    setIsCredSigningIn(false)
    if (!res?.ok) {
      if (res?.error && res.error !== 'CredentialsSignin') {
        setCredError(res.error)
      } else {
        setCredError('Invalid email or password.')
      }
    }
    // On success, the session update triggers the useEffect redirect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-7 p-8">
        {/* Logo & title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-primary text-primary-foreground mb-4">
            <OvLogo className="w-16 h-16" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Overlord Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to manage your overlord operations.
          </p>
        </div>

        {/* Status banners */}
        {verified && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 px-3 py-2 text-sm text-green-800 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Email verified — you can now sign in.
          </div>
        )}
        {verificationFailed && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Verification link is invalid or has expired.
          </div>
        )}

        {/* Email / password form */}
        <form onSubmit={handleCredentialsSignIn} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {credError && <p className="text-sm text-destructive">{credError}</p>}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isCredSigningIn || isGoogleSigningIn}
          >
            {isCredSigningIn ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Google */}
        <Button
          variant="outline"
          className="w-full gap-2"
          size="lg"
          disabled={isGoogleSigningIn || isCredSigningIn}
          onClick={async () => {
            if (isGoogleSigningIn) return
            setIsGoogleSigningIn(true)
            await fetch('/api/auth/reset', { method: 'POST' })
            await signIn('google', { callbackUrl: `${window.location.origin}/projects` })
          }}
        >
          <Chrome className="h-4 w-4" />
          {isGoogleSigningIn ? 'Redirecting…' : 'Continue with Google'}
        </Button>

        {/* Footer links */}
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
        <p className="text-center text-xs text-muted-foreground">
          Access is restricted to authorised team members only.
        </p>
      </div>
    </div>
  )
}

