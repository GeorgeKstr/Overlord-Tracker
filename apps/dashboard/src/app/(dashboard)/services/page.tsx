'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Server, Code2, LayoutGrid, LayoutList, Pencil } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import type { Project, Service } from '@platform/shared-types'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type ViewMode = 'card' | 'list'
type RuntimeStatus = 'RUNNING' | 'DOWN' | 'UNKNOWN'

type ExtendedService = Service & {
  project?: {
    id: string
    key: string
    name: string
  }
}

type PingResult = {
  status: RuntimeStatus
  latencyMs?: number
}

const RUNTIME_BADGE: Record<RuntimeStatus, 'success' | 'destructive' | 'outline'> = {
  RUNNING: 'success',
  DOWN: 'destructive',
  UNKNOWN: 'outline',
}

export default function ServicesPage() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [statusTab, setStatusTab] = useState<'ALL' | 'RUNNING' | 'DOWN'>('ALL')
  const [nameFilter, setNameFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('ALL')
  const [editUrlOpen, setEditUrlOpen] = useState(false)
  const [editingService, setEditingService] = useState<ExtendedService | null>(null)
  const [urlForm, setUrlForm] = useState({ baseUrl: '', healthUrl: '' })

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get<ExtendedService[]>('/services'),
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/projects'),
  })

  const { data: pingMap = {} } = useQuery({
    queryKey: [
      'services-ping',
      services.map((s) => `${s.id}:${s.healthUrl ?? s.baseUrl ?? ''}`).join('|'),
    ],
    enabled: services.length > 0,
    refetchInterval: 30_000,
    queryFn: async () => {
      const entries = await Promise.all(
        services.map(async (service) => {
          const pingUrl = service.healthUrl ?? service.baseUrl
          if (!pingUrl) return [service.id, { status: 'UNKNOWN' as const }] as const

          try {
            const res = await fetch(`/api/ping?url=${encodeURIComponent(pingUrl)}`)
            const data = (await res.json()) as { ok?: boolean; latencyMs?: number }
            if (data.ok) {
              return [service.id, { status: 'RUNNING' as const, latencyMs: data.latencyMs }] as const
            }
            return [service.id, { status: 'DOWN' as const }] as const
          } catch {
            return [service.id, { status: 'DOWN' as const }] as const
          }
        }),
      )
      return Object.fromEntries(entries) as Record<string, PingResult>
    },
  })

  const saveUrlMutation = useMutation({
    mutationFn: ({ serviceId, baseUrl, healthUrl }: { serviceId: string; baseUrl: string; healthUrl: string }) =>
      api.patch<Service>(`/services/${serviceId}`, {
        baseUrl: baseUrl || undefined,
        healthUrl: healthUrl || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
      setEditUrlOpen(false)
      setEditingService(null)
      setUrlForm({ baseUrl: '', healthUrl: '' })
    },
  })

  const openUrlEditor = (service: ExtendedService) => {
    setEditingService(service)
    setUrlForm({
      baseUrl: service.baseUrl ?? '',
      healthUrl: service.healthUrl ?? '',
    })
    setEditUrlOpen(true)
  }

  const filteredServices = useMemo(() => {
    const byProject = services.filter((service) =>
      projectFilter === 'ALL' ? true : service.projectId === projectFilter,
    )

    const byName = byProject.filter((service) => {
      if (!nameFilter.trim()) return true
      const q = nameFilter.toLowerCase()
      return (
        service.name.toLowerCase().includes(q)
        || service.slug.toLowerCase().includes(q)
        || (service.description ?? '').toLowerCase().includes(q)
      )
    })

    return byName.filter((service) => {
      const runtime = pingMap[service.id]?.status ?? 'UNKNOWN'
      if (statusTab === 'ALL') return true
      return runtime === statusTab
    })
  }, [services, projectFilter, nameFilter, pingMap, statusTab])

  const statusCounts = services.reduce(
    (acc, service) => {
      const runtime = pingMap[service.id]?.status ?? 'UNKNOWN'
      if (runtime === 'RUNNING') acc.RUNNING += 1
      if (runtime === 'DOWN') acc.DOWN += 1
      acc.ALL += 1
      return acc
    },
    { ALL: 0, RUNNING: 0, DOWN: 0 },
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Service Registry</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {services.length} registered service{services.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center rounded-md border p-0.5 gap-0.5">
          <Button
            variant={viewMode === 'card' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('card')}
            title="Card view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('list')}
            title="List view"
          >
            <LayoutList className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap border-b pb-3">
        {(['ALL', 'RUNNING', 'DOWN'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusTab(tab)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              statusTab === tab
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {tab === 'ALL' ? 'All' : tab === 'RUNNING' ? 'Running' : 'Down'}
            <span className={`rounded-full px-1.5 py-0.5 text-xs leading-none ${statusTab === tab ? 'bg-background/20' : 'bg-muted'}`}>
              {statusCounts[tab]}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <Input
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          placeholder="Filter by service name or slug"
        />
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Server className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-lg">No services match your filters</h3>
          <p className="text-sm text-muted-foreground mt-1">Try changing tabs or filters.</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredServices.map((service) => {
            const runtime = pingMap[service.id]?.status ?? 'UNKNOWN'
            const latency = pingMap[service.id]?.latencyMs
            return (
              <Card key={service.id} className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{service.name}</CardTitle>
                    <Badge variant={RUNTIME_BADGE[runtime]} className="ml-auto">
                      {runtime}
                    </Badge>
                  </div>
                  <code className="text-xs text-muted-foreground">{service.slug}</code>
                </CardHeader>
                <CardContent className="space-y-2">
                  {service.description ? (
                    <CardDescription className="text-xs">{service.description}</CardDescription>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Project: {service.project?.name ?? service.projectId}
                  </p>
                  {latency ? (
                    <p className="text-xs text-muted-foreground">Health latency: {latency}ms</p>
                  ) : null}
                  {(service.baseUrl || service.healthUrl) ? (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {service.baseUrl ? <p className="truncate">Base: {service.baseUrl}</p> : null}
                      {service.healthUrl ? <p className="truncate">Health: {service.healthUrl}</p> : null}
                    </div>
                  ) : null}
                  <div className="flex gap-2 pt-1">
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link href={`/projects/${service.projectId}?tab=apiSpec&specTarget=${service.id}`}>
                        <Code2 className="h-3 w-3 mr-1" />
                        Explore API
                      </Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openUrlEditor(service)}>
                      <Pencil className="h-3 w-3 mr-1" />
                      URLs
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Registered {formatDate(service.createdAt)}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border divide-y overflow-hidden">
          <div className="hidden md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px_minmax(0,2fr)_220px] items-center gap-3 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/40">
            <span>Service</span>
            <span>Project</span>
            <span>Status</span>
            <span>URLs</span>
            <span className="text-right">Actions</span>
          </div>
          {filteredServices.map((service) => {
            const runtime = pingMap[service.id]?.status ?? 'UNKNOWN'
            return (
              <div key={service.id} className="px-4 py-3 hover:bg-muted/50 transition-colors">
                <div className="md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px_minmax(0,2fr)_220px] md:items-center md:gap-3 space-y-2 md:space-y-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{service.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{service.slug}</p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{service.project?.name ?? service.projectId}</p>
                  <Badge variant={RUNTIME_BADGE[runtime]} className="w-fit">{runtime}</Badge>
                  <div className="text-xs text-muted-foreground min-w-0">
                    <p className="truncate">Base: {service.baseUrl ?? '—'}</p>
                    <p className="truncate">Health: {service.healthUrl ?? '—'}</p>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/projects/${service.projectId}?tab=apiSpec&specTarget=${service.id}`}>
                        <Code2 className="h-3 w-3 mr-1" />
                        Explore API
                      </Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openUrlEditor(service)}>
                      <Pencil className="h-3 w-3 mr-1" />
                      URLs
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={editUrlOpen} onOpenChange={setEditUrlOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Service URLs</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="base-url">Base URL</Label>
              <Input
                id="base-url"
                placeholder="https://service.example.com"
                value={urlForm.baseUrl}
                onChange={(e) => setUrlForm((f) => ({ ...f, baseUrl: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="health-url">Health URL</Label>
              <Input
                id="health-url"
                placeholder="https://service.example.com/health"
                value={urlForm.healthUrl}
                onChange={(e) => setUrlForm((f) => ({ ...f, healthUrl: e.target.value }))}
              />
            </div>
            {saveUrlMutation.isError ? (
              <p className="text-sm text-destructive">{(saveUrlMutation.error as Error)?.message ?? 'Failed to save URLs'}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUrlOpen(false)}>Cancel</Button>
            <Button
              disabled={!editingService || saveUrlMutation.isPending}
              onClick={() => {
                if (!editingService) return
                saveUrlMutation.mutate({
                  serviceId: editingService.id,
                  baseUrl: urlForm.baseUrl.trim(),
                  healthUrl: urlForm.healthUrl.trim(),
                })
              }}
            >
              {saveUrlMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
