'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, KeyRound, Trash2 } from 'lucide-react'
import { api } from '@/lib/api-client'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type PersonalToken = {
  id: string
  name: string
  last4: string
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
}

type CreatedToken = {
  id: string
  name: string
  last4: string
  createdAt: string
  expiresAt: string | null
  token: string
  note: string
}

export default function TokensPage() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [expiresInDays, setExpiresInDays] = useState('30')
  const [createdToken, setCreatedToken] = useState<CreatedToken | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ['personal-tokens'],
    queryFn: () => api.get<PersonalToken[]>('/users/me/tokens'),
  })

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; expiresInDays?: number }) =>
      api.post<CreatedToken>('/users/me/tokens', payload),
    onSuccess: (data) => {
      setCreatedToken(data)
      setName('')
      queryClient.invalidateQueries({ queryKey: ['personal-tokens'] })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (tokenId: string) => api.delete(`/users/me/tokens/${tokenId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-tokens'] })
    },
  })

  const expiresValue = useMemo(() => {
    const n = Number(expiresInDays)
    return Number.isFinite(n) && n > 0 ? n : undefined
  }, [expiresInDays])

  const copyCreatedToken = async () => {
    if (!createdToken?.token) return
    await navigator.clipboard.writeText(createdToken.token)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Personal Tokens</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create tokens for AI agents and scripts. Tokens inherit your project access.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token-name">Token name</Label>
            <Input
              id="token-name"
              placeholder="Agent for Sprint board"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2 max-w-[220px]">
            <Label htmlFor="expires-days">Expires in (days)</Label>
            <Input
              id="expires-days"
              type="number"
              min={1}
              max={365}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
            />
          </div>
          <Button
            onClick={() => createMutation.mutate({ name, expiresInDays: expiresValue })}
            disabled={!name.trim() || createMutation.isPending}
            className="gap-2"
          >
            <KeyRound className="h-4 w-4" />
            {createMutation.isPending ? 'Creating…' : 'Generate token'}
          </Button>
          {createMutation.isError && (
            <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
          )}
        </CardContent>
      </Card>

      {createdToken && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <p className="text-sm font-medium">New token created</p>
            <p className="text-xs text-muted-foreground">{createdToken.note}</p>
            <div className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs break-all">
              {createdToken.token}
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={copyCreatedToken}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy token'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3">
            <h2 className="text-sm font-medium">Active tokens</h2>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded bg-muted animate-pulse" />
              ))}
            </div>
          ) : tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tokens yet.</p>
          ) : (
            <div className="rounded-md border divide-y overflow-hidden">
              {tokens.map((t) => (
                <div key={t.id} className="px-3 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ••••{t.last4} · created {formatDate(t.createdAt)}
                      {t.lastUsedAt ? ` · used ${formatRelativeTime(t.lastUsedAt)}` : ' · never used'}
                      {t.expiresAt ? ` · expires ${formatDate(t.expiresAt)}` : ''}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    title="Revoke token"
                    onClick={() => {
                      if (confirm(`Revoke token \"${t.name}\"?`)) {
                        revokeMutation.mutate(t.id)
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
