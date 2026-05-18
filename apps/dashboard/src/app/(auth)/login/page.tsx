'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chrome } from 'lucide-react'

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isSigningIn, setIsSigningIn] = useState(false)

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 p-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground text-2xl font-bold mb-4">
            P
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Platform Control Plane
          </h1>
          <p className="text-sm text-muted-foreground">
            Internal developer platform. Sign in to continue.
          </p>
        </div>

        <Button
          className="w-full gap-2"
          size="lg"
          disabled={isSigningIn}
          onClick={async () => {
            if (isSigningIn) return
            setIsSigningIn(true)
            await fetch('/api/auth/reset', { method: 'POST' })
            await signIn('google', { callbackUrl: `${window.location.origin}/projects` })
          }}
        >
          <Chrome className="h-4 w-4" />
          {isSigningIn ? 'Redirecting…' : 'Continue with Google'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Access is restricted to authorised team members only.
        </p>
      </div>
    </div>
  )
}
