'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Shield, Lock, CheckCircle, XCircle, Search, UserX, Database, Download, Upload, Trash2, AlertTriangle, Copy, Check } from 'lucide-react'
import { api } from '@/lib/api-client'
import { getStoredOverlordBaseUrl, setStoredOverlordBaseUrl } from '@/lib/overlord-links'
import type { PlatformRole, UserSummary } from '@platform/shared-types'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type RoleUpdateResponse = UserSummary

type UsersSort = 'role-asc' | 'role-desc' | 'name-asc' | 'name-desc' | 'email-asc' | 'email-desc'
type PendingSort = 'name-asc' | 'name-desc' | 'email-asc' | 'email-desc'

const ROLE_RANK: Record<PlatformRole, number> = { ADMIN: 0, MODERATOR: 1, USER: 2 }

export default function AdminPage() {
  const queryClient = useQueryClient()
  const router = useRouter()

  const [usersSearch, setUsersSearch] = useState('')
  const [usersSort, setUsersSort] = useState<UsersSort>('role-asc')
  const [pendingSearch, setPendingSearch] = useState('')
  const [pendingSort, setPendingSort] = useState<PendingSort>('name-asc')
  const [overlordBaseUrl, setOverlordBaseUrl] = useState('')
  const [baseUrlSaved, setBaseUrlSaved] = useState(false)
  const [envOpen, setEnvOpen] = useState(false)
  const [envForm, setEnvForm] = useState({
    dashboardUrl: '',
    apiUrl: '',
    adminEmail: 'admin@example.com',
    jwtSecret: 'replace-with-openssl-rand-base64-32',
    nextAuthSecret: 'replace-with-openssl-rand-base64-32',
    smtpHost: 'smtp.gmail.com',
    smtpPort: '587',
    smtpUser: 'youraddress@gmail.com',
    smtpPass: 'your-google-app-password',
    smtpFrom: 'Overlord Tracker <youraddress@gmail.com>',
    googleClientId: 'your-google-client-id',
    googleClientSecret: 'your-google-client-secret',
  })
  const [copiedEnvKey, setCopiedEnvKey] = useState<string | null>(null)

  useEffect(() => {
    setOverlordBaseUrl(getStoredOverlordBaseUrl())
    setEnvForm((current) => ({
      ...current,
      dashboardUrl: localStorage.getItem('overlord.admin.deploymentDashboardUrl') ?? window.location.origin,
      apiUrl: localStorage.getItem('overlord.admin.deploymentApiUrl') ?? getStoredOverlordBaseUrl(),
      adminEmail: localStorage.getItem('overlord.admin.env.adminEmail') ?? current.adminEmail,
      smtpFrom: localStorage.getItem('overlord.admin.env.smtpFrom') ?? current.smtpFrom,
      smtpUser: localStorage.getItem('overlord.admin.env.smtpUser') ?? current.smtpUser,
      smtpHost: localStorage.getItem('overlord.admin.env.smtpHost') ?? current.smtpHost,
      smtpPort: localStorage.getItem('overlord.admin.env.smtpPort') ?? current.smtpPort,
      googleClientId: localStorage.getItem('overlord.admin.env.googleClientId') ?? current.googleClientId,
      googleClientSecret: localStorage.getItem('overlord.admin.env.googleClientSecret') ?? current.googleClientSecret,
    }))
  }, [])

  useEffect(() => {
    localStorage.setItem('overlord.admin.deploymentDashboardUrl', envForm.dashboardUrl)
    localStorage.setItem('overlord.admin.deploymentApiUrl', envForm.apiUrl)
    localStorage.setItem('overlord.admin.env.adminEmail', envForm.adminEmail)
    localStorage.setItem('overlord.admin.env.smtpFrom', envForm.smtpFrom)
    localStorage.setItem('overlord.admin.env.smtpUser', envForm.smtpUser)
    localStorage.setItem('overlord.admin.env.smtpHost', envForm.smtpHost)
    localStorage.setItem('overlord.admin.env.smtpPort', envForm.smtpPort)
    localStorage.setItem('overlord.admin.env.googleClientId', envForm.googleClientId)
    localStorage.setItem('overlord.admin.env.googleClientSecret', envForm.googleClientSecret)
  }, [envForm])

  const apiEnvTemplate = useMemo(() => {
    return [
      'DATABASE_URL=${{Postgres.DATABASE_URL}}',
      'PORT=3001',
      `DASHBOARD_URL=${envForm.dashboardUrl || 'https://your-dashboard.up.railway.app'}`,
      `API_URL=${envForm.apiUrl || 'https://your-api.up.railway.app'}`,
      `JWT_SECRET=${envForm.jwtSecret || 'replace-with-openssl-rand-base64-32'}`,
      `ADMIN_EMAIL=${envForm.adminEmail || 'admin@example.com'}`,
      `SMTP_HOST=${envForm.smtpHost || 'smtp.gmail.com'}`,
      `SMTP_PORT=${envForm.smtpPort || '587'}`,
      `SMTP_USER=${envForm.smtpUser || 'youraddress@gmail.com'}`,
      `SMTP_PASS=${envForm.smtpPass || 'your-google-app-password'}`,
      `SMTP_FROM=${envForm.smtpFrom || 'Overlord Tracker <youraddress@gmail.com>'}`,
    ].join('\n')
  }, [envForm])

  const dashboardEnvTemplate = useMemo(() => {
    return [
      'DATABASE_URL=${{Postgres.DATABASE_URL}}',
      `NEXTAUTH_SECRET=${envForm.nextAuthSecret || 'replace-with-openssl-rand-base64-32'}`,
      `NEXTAUTH_URL=${envForm.dashboardUrl || 'https://your-dashboard.up.railway.app'}`,
      `NEXT_PUBLIC_API_URL=${envForm.apiUrl || 'https://your-api.up.railway.app'}`,
      `GOOGLE_CLIENT_ID=${envForm.googleClientId || 'your-google-client-id'}`,
      `GOOGLE_CLIENT_SECRET=${envForm.googleClientSecret || 'your-google-client-secret'}`,
    ].join('\n')
  }, [envForm])

  const googleEnvTemplate = useMemo(() => {
    return [
      `GOOGLE_CLIENT_ID=${envForm.googleClientId || 'your-google-client-id'}`,
      `GOOGLE_CLIENT_SECRET=${envForm.googleClientSecret || 'your-google-client-secret'}`,
      `NEXTAUTH_URL=${envForm.dashboardUrl || 'https://your-dashboard.up.railway.app'}`,
    ].join('\n')
  }, [envForm.googleClientId, envForm.googleClientSecret, envForm.dashboardUrl])

  const copyEnv = async (key: 'api' | 'dashboard' | 'google', content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedEnvKey(key)
      setTimeout(() => setCopiedEnvKey(null), 1500)
    } catch {
      // Ignore clipboard failures.
    }
  }

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<UserSummary>('/users/me'),
  })

  const isAdmin = meQuery.data?.role === 'ADMIN' || meQuery.data?.isProtected === true

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<UserSummary[]>('/users'),
    enabled: isAdmin,
  })

  const pendingQuery = useQuery({
    queryKey: ['users', 'pending'],
    queryFn: () => api.get<UserSummary[]>('/users/pending'),
    enabled: isAdmin,
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: PlatformRole }) =>
      api.post<RoleUpdateResponse>(`/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })

  const approveMutation = useMutation({
    mutationFn: (userId: string) => api.post<RoleUpdateResponse>(`/users/${userId}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'pending'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/users/${userId}/reject`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'pending'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const wipeMutation = useMutation({
    mutationFn: () => api.post<{ ok: boolean; message: string }>('/admin/wipe', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'pending'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['services'] })
      queryClient.invalidateQueries({ queryKey: ['labels'] })
      queryClient.invalidateQueries({ queryKey: ['members'] })
    },
  })

  const exportMutation = useMutation({
    mutationFn: async () => {
      const data = await api.get<Record<string, unknown>>('/admin/export')
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `overlord-db-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return data
    },
  })

  const importMutation = useMutation({
    mutationFn: (snapshot: unknown) => api.post<{ ok: boolean; message: string }>('/admin/import', snapshot as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'pending'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['services'] })
      queryClient.invalidateQueries({ queryKey: ['labels'] })
      queryClient.invalidateQueries({ queryKey: ['members'] })
    },
  })

  useEffect(() => {
    if (!meQuery.isLoading && !isAdmin) {
      router.replace('/projects')
    }
  }, [isAdmin, meQuery.isLoading, router])

  const filteredUsers = useMemo(() => {
    const q = usersSearch.toLowerCase()
    const users = (usersQuery.data ?? []).filter(
      (u) =>
        !q ||
        u.email.toLowerCase().includes(q) ||
        (u.name ?? '').toLowerCase().includes(q),
    )
    return [...users].sort((a, b) => {
      switch (usersSort) {
        case 'role-asc':
          return (
            ROLE_RANK[(a.role ?? 'USER') as PlatformRole] -
              ROLE_RANK[(b.role ?? 'USER') as PlatformRole] ||
            a.email.localeCompare(b.email)
          )
        case 'role-desc':
          return (
            ROLE_RANK[(b.role ?? 'USER') as PlatformRole] -
              ROLE_RANK[(a.role ?? 'USER') as PlatformRole] ||
            a.email.localeCompare(b.email)
          )
        case 'name-asc':
          return (a.name ?? a.email).localeCompare(b.name ?? b.email)
        case 'name-desc':
          return (b.name ?? b.email).localeCompare(a.name ?? a.email)
        case 'email-asc':
          return a.email.localeCompare(b.email)
        case 'email-desc':
          return b.email.localeCompare(a.email)
        default:
          return 0
      }
    })
  }, [usersQuery.data, usersSearch, usersSort])

  const filteredPending = useMemo(() => {
    const q = pendingSearch.toLowerCase()
    const users = (pendingQuery.data ?? []).filter(
      (u) =>
        !q ||
        u.email.toLowerCase().includes(q) ||
        (u.name ?? '').toLowerCase().includes(q),
    )
    return [...users].sort((a, b) => {
      switch (pendingSort) {
        case 'name-asc':
          return (a.name ?? a.email).localeCompare(b.name ?? b.email)
        case 'name-desc':
          return (b.name ?? b.email).localeCompare(a.name ?? a.email)
        case 'email-asc':
          return a.email.localeCompare(b.email)
        case 'email-desc':
          return b.email.localeCompare(a.email)
        default:
          return 0
      }
    })
  }, [pendingQuery.data, pendingSearch, pendingSort])

  if (meQuery.isLoading) {
    return <div className="h-24 rounded-lg bg-muted animate-pulse" />
  }

  if (!isAdmin) return null

  const pendingCount = pendingQuery.data?.length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Admin Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage platform roles and approve sign-up requests.
        </p>
      </div>

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">User Roles</TabsTrigger>
          <TabsTrigger value="pending" className="gap-1.5">
            Pending Requests
            {pendingCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="migrations" className="gap-1.5">
            <Database className="h-3.5 w-3.5" />
            Migrations
          </TabsTrigger>
        </TabsList>

        {/* ── User Roles tab ─────────────────────────────────────── */}
        <TabsContent value="roles" className="mt-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search by name or email…"
                    value={usersSearch}
                    onChange={(e) => setUsersSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={usersSort} onValueChange={(v) => setUsersSort(v as UsersSort)}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="role-asc">Role (Admin first)</SelectItem>
                    <SelectItem value="role-desc">Role (User first)</SelectItem>
                    <SelectItem value="name-asc">Name A → Z</SelectItem>
                    <SelectItem value="name-desc">Name Z → A</SelectItem>
                    <SelectItem value="email-asc">Email A → Z</SelectItem>
                    <SelectItem value="email-desc">Email Z → A</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* List */}
              {usersQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-12 rounded bg-muted animate-pulse" />
                  ))}
                </div>
              ) : usersQuery.isError ? (
                <p className="text-sm text-destructive">
                  {(usersQuery.error as Error)?.message ?? 'Could not load users'}
                </p>
              ) : filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No users match your search.
                </p>
              ) : (
                <div className="rounded-lg border divide-y">
                  {filteredUsers.map((u) => {
                    const role = (u.role ?? 'USER') as PlatformRole
                    const isSelf = meQuery.data?.id === u.id
                    const locked = isSelf || !!u.isProtected
                    const isBanned = u.status === 'REJECTED'
                    return (
                      <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate flex items-center gap-1.5">
                            {u.name ?? 'Unnamed user'}
                            {u.isProtected && (
                              <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                            )}
                            {isSelf && (
                              <span className="text-xs font-normal text-muted-foreground">(you)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Banned badge */}
                          {isBanned && (
                            <Badge variant="destructive" className="text-xs">Banned</Badge>
                          )}
                          {/* Ban button (before toggle) for active users */}
                          {!locked && !isBanned && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              disabled={rejectMutation.isPending}
                              onClick={() => rejectMutation.mutate(u.id)}
                              title="Ban user"
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {/* Unban button for banned users */}
                          {!locked && isBanned && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate(u.id)}
                            >
                              Unban
                            </Button>
                          )}
                          {/* 3-way role toggle – hidden for banned users */}
                          {!isBanned && (
                            <div
                              className={cn(
                                'flex rounded-md border overflow-hidden text-xs font-medium',
                                locked && 'opacity-50',
                              )}
                            >
                              {(['USER', 'MODERATOR', 'ADMIN'] as PlatformRole[]).map((r, i) => (
                                <button
                                  key={r}
                                  disabled={locked || updateRoleMutation.isPending}
                                  onClick={() =>
                                    role !== r && updateRoleMutation.mutate({ userId: u.id, role: r })
                                  }
                                  className={cn(
                                    'px-2.5 py-1.5 transition-colors',
                                    i > 0 && 'border-l',
                                    role === r
                                      ? 'bg-primary text-primary-foreground cursor-default'
                                      : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                                  )}
                                >
                                  {r === 'MODERATOR' ? 'Mod' : r[0] + r.slice(1).toLowerCase()}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {updateRoleMutation.isError && (
                <p className="text-xs text-destructive">
                  {(updateRoleMutation.error as Error)?.message ?? 'Could not update role'}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Pending Requests tab ───────────────────────────────── */}
        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search by name or email…"
                    value={pendingSearch}
                    onChange={(e) => setPendingSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select
                  value={pendingSort}
                  onValueChange={(v) => setPendingSort(v as PendingSort)}
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Name A → Z</SelectItem>
                    <SelectItem value="name-desc">Name Z → A</SelectItem>
                    <SelectItem value="email-asc">Email A → Z</SelectItem>
                    <SelectItem value="email-desc">Email Z → A</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* List */}
              {pendingQuery.isLoading ? (
                <div className="h-10 rounded bg-muted animate-pulse" />
              ) : filteredPending.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {pendingSearch ? 'No users match your search.' : 'No pending requests.'}
                </p>
              ) : (
                <div className="rounded-lg border divide-y">
                  {filteredPending.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{u.name ?? 'Unnamed user'}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          onClick={() => approveMutation.mutate(u.id)}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          onClick={() => rejectMutation.mutate(u.id)}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(approveMutation.isError || rejectMutation.isError) && (
                <p className="text-xs text-destructive">
                  {((approveMutation.error ?? rejectMutation.error) as Error)?.message ??
                    'Action failed'}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Migrations tab ─────────────────────────────────────── */}
        <TabsContent value="migrations" className="mt-4">
          <div className="space-y-4">

            {/* Global API links */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold">Overlord API Base URL</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Controls dashboard quick links for base URL and schema API (docs-json).
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={overlordBaseUrl}
                    placeholder="http://localhost:3001"
                    onChange={(e) => {
                      setOverlordBaseUrl(e.target.value)
                      if (baseUrlSaved) setBaseUrlSaved(false)
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setStoredOverlordBaseUrl(overlordBaseUrl)
                      setOverlordBaseUrl(getStoredOverlordBaseUrl())
                      setBaseUrlSaved(true)
                    }}
                  >
                    Save URL
                  </Button>
                </div>
                {baseUrlSaved && (
                  <p className="text-xs text-emerald-600">Overlord base URL saved.</p>
                )}
              </CardContent>
            </Card>

            {/* Database Management */}
            <Card>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold">Database Management</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Export, import, and wipe database data from one place.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-3 border rounded-md p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                          <Download className="h-4 w-4" />
                          Export Database
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Download a full JSON snapshot of all database records (users, projects, tickets, services, etc.).
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={exportMutation.isPending}
                        onClick={() => exportMutation.mutate()}
                      >
                        {exportMutation.isPending ? 'Exporting…' : 'Download JSON'}
                      </Button>
                    </div>
                    {exportMutation.isError && (
                      <p className="text-xs text-destructive">
                        {(exportMutation.error as Error)?.message ?? 'Export failed'}
                      </p>
                    )}
                    {exportMutation.isSuccess && (
                      <p className="text-xs text-emerald-600">Export downloaded successfully.</p>
                    )}
                  </div>

                  <div className="space-y-3 border rounded-md p-3">
                    <div>
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        <Upload className="h-4 w-4" />
                        Import Database
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Upload a previously exported JSON snapshot. <span className="font-medium text-amber-600">This will wipe the current database first.</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="import-file"
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          if (!window.confirm('This will WIPE the current database and replace it with the imported snapshot. Continue?')) {
                            e.target.value = ''
                            return
                          }
                          try {
                            const text = await file.text()
                            const data = JSON.parse(text)
                            importMutation.mutate(data)
                          } catch {
                            alert('Invalid JSON file')
                          }
                          e.target.value = ''
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={importMutation.isPending}
                        onClick={() => document.getElementById('import-file')?.click()}
                      >
                        {importMutation.isPending ? 'Importing…' : 'Choose JSON file'}
                      </Button>
                    </div>
                    {importMutation.isError && (
                      <p className="text-xs text-destructive">
                        {(importMutation.error as Error)?.message ?? 'Import failed'}
                      </p>
                    )}
                    {importMutation.isSuccess && (
                      <p className="text-xs text-emerald-600">{importMutation.data?.message ?? 'Import complete.'}</p>
                    )}
                  </div>

                  <div className="space-y-3 border rounded-md p-3 border-destructive/40">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold flex items-center gap-1.5 text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          Wipe Database
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Permanently delete all data — projects, tickets, services, users — except ADMIN accounts.
                          <span className="font-medium text-destructive"> This cannot be undone.</span>
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={wipeMutation.isPending}
                        onClick={() => {
                          if (!window.confirm('DANGER: This will permanently delete ALL data except admin accounts. Are you absolutely sure?')) return
                          wipeMutation.mutate()
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        {wipeMutation.isPending ? 'Wiping…' : 'Wipe Database'}
                      </Button>
                    </div>
                    {wipeMutation.isError && (
                      <p className="text-xs text-destructive">
                        {(wipeMutation.error as Error)?.message ?? 'Wipe failed'}
                      </p>
                    )}
                    {wipeMutation.isSuccess && (
                      <p className="text-xs text-emerald-600">{wipeMutation.data?.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Environment */}
            <Card>
              <CardContent className="pt-4">
                <button
                  type="button"
                  onClick={() => setEnvOpen((open) => !open)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div>
                    <p className="text-sm font-semibold">Environment</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Configure deployment variables as a form and copy API/Dashboard env blocks.
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{envOpen ? 'Hide' : 'Show'}</span>
                </button>

                {envOpen && (
                  <div className="space-y-4 mt-4 border-t pt-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Dashboard URL</p>
                        <Input
                          value={envForm.dashboardUrl}
                          placeholder="https://your-dashboard.up.railway.app"
                          onChange={(e) => setEnvForm((f) => ({ ...f, dashboardUrl: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">API URL</p>
                        <Input
                          value={envForm.apiUrl}
                          placeholder="https://your-api.up.railway.app"
                          onChange={(e) => setEnvForm((f) => ({ ...f, apiUrl: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Admin email</p>
                        <Input
                          value={envForm.adminEmail}
                          onChange={(e) => setEnvForm((f) => ({ ...f, adminEmail: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">JWT secret</p>
                        <Input
                          value={envForm.jwtSecret}
                          onChange={(e) => setEnvForm((f) => ({ ...f, jwtSecret: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">NextAuth secret</p>
                        <Input
                          value={envForm.nextAuthSecret}
                          onChange={(e) => setEnvForm((f) => ({ ...f, nextAuthSecret: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Google client ID</p>
                        <Input
                          value={envForm.googleClientId}
                          onChange={(e) => setEnvForm((f) => ({ ...f, googleClientId: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <p className="text-xs font-medium text-muted-foreground">Google client secret</p>
                        <Input
                          value={envForm.googleClientSecret}
                          onChange={(e) => setEnvForm((f) => ({ ...f, googleClientSecret: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 border rounded-md p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground">Google OAuth settings</p>
                        <Button size="sm" variant="outline" onClick={() => copyEnv('google', googleEnvTemplate)}>
                          {copiedEnvKey === 'google' ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                          Copy Google env
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Redirect URI to set in Google Console: {envForm.dashboardUrl || 'https://your-dashboard.up.railway.app'}/api/auth/callback/google
                      </p>
                      <Textarea value={googleEnvTemplate} readOnly rows={4} className="font-mono text-xs" />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">SMTP host</p>
                        <Input
                          value={envForm.smtpHost}
                          onChange={(e) => setEnvForm((f) => ({ ...f, smtpHost: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">SMTP port</p>
                        <Input
                          value={envForm.smtpPort}
                          onChange={(e) => setEnvForm((f) => ({ ...f, smtpPort: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">SMTP user</p>
                        <Input
                          value={envForm.smtpUser}
                          onChange={(e) => setEnvForm((f) => ({ ...f, smtpUser: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">SMTP pass</p>
                        <Input
                          value={envForm.smtpPass}
                          onChange={(e) => setEnvForm((f) => ({ ...f, smtpPass: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <p className="text-xs font-medium text-muted-foreground">SMTP from</p>
                        <Input
                          value={envForm.smtpFrom}
                          onChange={(e) => setEnvForm((f) => ({ ...f, smtpFrom: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground">API service variables</p>
                        <Button size="sm" variant="outline" onClick={() => copyEnv('api', apiEnvTemplate)}>
                          {copiedEnvKey === 'api' ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                          Copy API env
                        </Button>
                      </div>
                      <Textarea value={apiEnvTemplate} readOnly rows={11} className="font-mono text-xs" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground">Dashboard service variables</p>
                        <Button size="sm" variant="outline" onClick={() => copyEnv('dashboard', dashboardEnvTemplate)}>
                          {copiedEnvKey === 'dashboard' ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                          Copy Dashboard env
                        </Button>
                      </div>
                      <Textarea value={dashboardEnvTemplate} readOnly rows={7} className="font-mono text-xs" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
