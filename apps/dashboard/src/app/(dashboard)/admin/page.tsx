'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Shield, Lock, CheckCircle, XCircle, Search, UserX } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { PlatformRole, UserSummary } from '@platform/shared-types'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<UserSummary>('/users/me'),
  })

  const isAdmin = meQuery.data?.role === 'ADMIN'

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

  useEffect(() => {
    if (!meQuery.isLoading && meQuery.data?.role !== 'ADMIN') {
      router.replace('/projects')
    }
  }, [meQuery.data?.role, meQuery.isLoading, router])

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

  if (meQuery.data?.role !== 'ADMIN') return null

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
      </Tabs>
    </div>
  )
}
