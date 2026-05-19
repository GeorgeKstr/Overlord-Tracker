'use client'

import { ClockIcon, XCircle } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export default function PendingPage() {
  const { data: session } = useSession()
  const isRejected = session?.user?.status === 'REJECTED'

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full text-center space-y-6 px-4">
        <div className="flex justify-center">
          <div className={`rounded-full p-4 ${isRejected ? 'bg-destructive/10' : 'bg-amber-500/10'}`}>
            {isRejected ? (
              <XCircle className="h-10 w-10 text-destructive" />
            ) : (
              <ClockIcon className="h-10 w-10 text-amber-600" />
            )}
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isRejected ? 'Access denied' : 'Awaiting approval'}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {isRejected
              ? 'Your sign-up request was not approved. Contact an administrator if you think this is a mistake.'
              : 'Your account has been created but needs to be approved by an admin before you can access the platform. You will be able to sign in once approved.'}
          </p>
        </div>
        {!isRejected && (
          <p className="text-xs text-muted-foreground">
            If you were invited to a project, make sure you are signing in with the same email
            address the invitation was sent to.
          </p>
        )}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          {isRejected ? 'Back to sign in' : 'Sign out and try a different account'}
        </Button>
      </div>
    </div>
  )
}
