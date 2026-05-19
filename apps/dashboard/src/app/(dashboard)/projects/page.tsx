'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, FolderKanban, ExternalLink, Github, Globe, LayoutGrid, LayoutList } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import type { Project, Ticket as TicketType, UserSummary } from '@platform/shared-types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'success'> = {
  ACTIVE: 'success',
  ARCHIVED: 'secondary',
  INACTIVE: 'outline',
}

export default function ProjectsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'cards' | 'list'>('cards')
  const [form, setForm] = useState({ name: '', key: '', description: '', gitRepoUrl: '', websiteUrl: '' })

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/projects'),
  })
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<UserSummary>('/users/me'),
  })
  const projects = projectsQuery.data ?? []
  const isLoading = projectsQuery.isLoading
  const canCreateProject =
    meQuery.data?.role === 'MODERATOR' || meQuery.data?.role === 'ADMIN'

  const { data: allTickets = [] } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => api.get<TicketType[]>('/tickets'),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post<Project>('/projects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setOpen(false)
      setForm({ name: '', key: '', description: '', gitRepoUrl: '', websiteUrl: '' })
    },
  })

  const handleNameChange = (name: string) => {
    const key = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
    setForm((f) => ({ ...f, name, key }))
  }

  const progressByProject = allTickets.reduce((acc, t) => {
    const entry = acc[t.projectId] ?? { done: 0, total: 0 }
    entry.total += 1
    if (t.status === 'DONE') entry.done += 1
    acc[t.projectId] = entry
    return acc
  }, {} as Record<string, { done: number; total: number }>)

  const getProgress = (projectId: string) => {
    const entry = progressByProject[projectId] ?? { done: 0, total: 0 }
    const pct = entry.total === 0 ? 0 : Math.round((entry.done / entry.total) * 100)
    return { ...entry, pct }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border p-0.5 gap-0.5">
            <Button
              variant={view === 'cards' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setView('cards')}
              title="Cards view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setView('list')}
              title="List view"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>
          {canCreateProject && (
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          )}
        </div>
      </div>

      {!canCreateProject && !meQuery.isLoading && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700">
          Only moderators can create projects. Ask an admin to grant moderator access.
        </div>
      )}

      {projectsQuery.isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">Could not load projects</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {(projectsQuery.error as Error)?.message ?? 'Unknown API error'}
          </p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-lg">No projects yet</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Create your first project to get started.
          </p>
          {canCreateProject && (
            <Button onClick={() => setOpen(true)} variant="outline">
              Create project
            </Button>
          )}
        </div>
      ) : view === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const progress = getProgress(project.id)
            return (
            <Card
              key={project.id}
              className="hover:shadow-md transition-shadow cursor-pointer hover:border-primary/40"
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/projects/${project.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  router.push(`/projects/${project.id}`)
                }
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">
                    {project.name}
                  </CardTitle>
                  <Badge variant={STATUS_VARIANT[project.status] ?? 'outline'}>
                    {project.status}
                  </Badge>
                </div>
                <code className="text-xs text-muted-foreground font-mono">
                  {project.key}
                </code>
              </CardHeader>
              <CardContent className="space-y-3">
                {project.description && (
                  <CardDescription className="line-clamp-2">
                    {project.description}
                  </CardDescription>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{project._count?.tickets ?? 0} tickets</span>
                  <span>{project._count?.services ?? 0} services</span>
                  <span className="ml-auto">{formatDate(project.createdAt)}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{progress.done}/{progress.total} · {progress.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${progress.pct}%` }} />
                  </div>
                </div>
                {(project.gitRepoUrl || project.websiteUrl) && (
                  <div className="flex flex-col items-start gap-1.5 text-xs">
                    {project.gitRepoUrl && (
                      <a
                        href={project.gitRepoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Github className="h-3 w-3" />
                        Repo
                      </a>
                    )}
                    {project.websiteUrl && (
                      <a
                        href={project.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Globe className="h-3 w-3" />
                        Website
                      </a>
                    )}
                  </div>
                )}
                <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link href={`/projects/${project.id}`}>
                      Open
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="flex-1">
                    <Link href={`/projects/${project.id}/tickets`}>
                      Tickets
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border divide-y overflow-hidden">
          <div className="hidden md:grid md:grid-cols-[minmax(0,1.2fr)_96px_80px_80px_180px_120px_200px] items-center gap-3 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/40">
            <span>Project</span>
            <span>Status</span>
            <span>Tickets</span>
            <span>Services</span>
            <span>Progress</span>
            <span>Created</span>
            <span className="text-right">Actions</span>
          </div>
          {projects.map((project) => {
            const progress = getProgress(project.id)
            return (
            <div
              key={project.id}
              className="px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/projects/${project.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  router.push(`/projects/${project.id}`)
                }
              }}
            >
              <div className="md:grid md:grid-cols-[minmax(0,1.2fr)_96px_80px_80px_180px_120px_200px] md:items-center md:gap-3 flex items-center gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{project.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{project.key}</p>
                </div>
                <Badge variant={STATUS_VARIANT[project.status] ?? 'outline'} className="w-fit">{project.status}</Badge>
                <span className="text-xs text-muted-foreground">{project._count?.tickets ?? 0}</span>
                <span className="text-xs text-muted-foreground">{project._count?.services ?? 0}</span>
                <div className="hidden md:block min-w-0">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>{progress.done}/{progress.total}</span>
                    <span>{progress.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${progress.pct}%` }} />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(project.createdAt)}</span>
                <div className="ml-auto md:ml-0 md:justify-self-end flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/projects/${project.id}`}>Open</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/projects/${project.id}/tickets`}>Tickets</Link>
                  </Button>
                </div>
              </div>
            </div>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="My Platform"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                placeholder="my-platform"
                value={form.key}
                onChange={(e) =>
                  setForm((f) => ({ ...f, key: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Unique slug identifier. Lowercase letters, numbers, and hyphens only.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What is this project for?"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gitRepoUrl">Git Repository URL (optional)</Label>
              <div className="relative">
                <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="gitRepoUrl"
                  className="pl-9"
                  placeholder="https://github.com/org/repo"
                  value={form.gitRepoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, gitRepoUrl: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL (optional)</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="websiteUrl"
                  className="pl-9"
                  placeholder="https://myapp.com"
                  value={form.websiteUrl}
                  onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || !form.key || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create project'}
            </Button>
          </DialogFooter>
          {createMutation.isError && (
            <p className="text-xs text-destructive mt-2">
              {(createMutation.error as Error)?.message ?? 'Could not create project'}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
