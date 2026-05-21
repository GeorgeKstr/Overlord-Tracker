'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  Plus,
  ArrowLeft,
  Tag,
  LayoutGrid,
  LayoutList,
  X,
  UserCircle2,
  Search,
  CheckCircle2,
  UserCheck,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_EFFORT_LABELS,
  formatRelativeTime,
  cn,
} from '@/lib/utils'
import type { Ticket, Project, Label, UserSummary, ProjectMember, Service } from '@platform/shared-types'
import { DataPaginator } from '@/components/pagination/data-paginator'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label as FormLabel } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LabelBadge } from '@/components/labels/label-badge'
import { StatusBadge, StatusIcon, PriorityBadge, PriorityIcon } from '@/components/tickets/ticket-meta'

const ALL_STATUSES = ['OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'] as const
type ViewMode = 'grid' | 'list'

const LIST_COLS_WITH_LABELS = 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,3fr)_minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,2fr)]'
const LIST_COLS_NO_LABELS  = 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,3fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,2fr)]'
const PRIORITY_SORT: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const EFFORT_SORT: Record<string, number>   = { EPIC: 0, NORMAL: 1, MINOR: 2 }
const STATUS_SORT: Record<string, number>   = { OPEN: 0, IN_PROGRESS: 1, IN_REVIEW: 2, DONE: 3, CANCELLED: 4 }

type PaginatedResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function toInitials(user: UserSummary) {
  return (user.name ?? user.email).slice(0, 2).toUpperCase()
}

export default function TicketsPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')
  const [serviceFilter, setServiceFilter] = useState<string>('ALL')
  const [effortFilter, setEffortFilter] = useState<string>('ALL')
  const [assignedToMe, setAssignedToMe] = useState(false)
  const [testedFilter, setTestedFilter] = useState<string>('ALL')
  const [includeSubtickets, setIncludeSubtickets] = useState(false)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window === 'undefined') return 20
    const raw = Number(localStorage.getItem('overlord.projectTickets.pageSize') ?? '20')
    return [10, 20, 50].includes(raw) ? raw : 20
  })
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    status: 'OPEN',
    effort: '',
    parentTicketId: '',
    assigneeId: '',
    serviceId: '',
  })

  const { data: project } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.get<Project>(`/projects/${id}`),
    enabled: !!id,
  })

  const { data: ticketsPage, isLoading } = useQuery({
    queryKey: ['tickets', { projectId: id, page, pageSize, statusFilter, priorityFilter, serviceFilter, effortFilter, assignedToMe, testedFilter, includeSubtickets, search, me: session?.user?.id }],
    queryFn: () => {
      const params = new URLSearchParams({
        projectId: id,
        page: String(page),
        pageSize: String(pageSize),
      })
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (priorityFilter !== 'ALL') params.set('priority', priorityFilter)
      if (serviceFilter !== 'ALL') params.set('serviceId', serviceFilter)
      if (effortFilter !== 'ALL') params.set('effort', effortFilter)
      if (assignedToMe && session?.user?.id) params.set('assigneeId', session.user.id)
      if (testedFilter === 'TESTED') params.set('tested', 'true')
      if (testedFilter === 'UNTESTED') params.set('tested', 'false')
      if (includeSubtickets) params.set('includeSubtickets', 'true')
      if (search.trim()) params.set('q', search.trim())
      return api.get<PaginatedResponse<Ticket>>(`/tickets?${params.toString()}`)
    },
    enabled: !!id,
  })
  const ticketItems = ticketsPage?.items ?? []
  const totalTickets = ticketsPage?.total ?? 0
  const totalPages = ticketsPage?.totalPages ?? 1

  const { data: labels = [] } = useQuery({
    queryKey: ['labels', id],
    queryFn: () => api.get<Label[]>(`/labels?projectId=${id}`),
    enabled: !!id,
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members', id],
    queryFn: () => api.get<ProjectMember[]>(`/projects/${id}/members`),
    enabled: !!id,
  })

  const { data: services = [] } = useQuery({
    queryKey: ['services', { projectId: id }],
    queryFn: () => api.get<Service[]>(`/services?projectId=${id}`),
    enabled: !!id,
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      api.post<Ticket>('/tickets', {
        ...data,
        projectId: id,
        effort: data.effort || undefined,
        parentTicketId: data.parentTicketId || undefined,
        assigneeId: data.assigneeId || undefined,
        serviceId: data.serviceId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', { projectId: id }] })
      setOpen(false)
      setForm({ title: '', description: '', priority: 'MEDIUM', status: 'OPEN', effort: '', parentTicketId: '', assigneeId: '', serviceId: '' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ ticketId, patch }: { ticketId: string; patch: Record<string, unknown> }) =>
      api.patch<Ticket>(`/tickets/${ticketId}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['projects', id] })
    },
  })

  useEffect(() => {
    localStorage.setItem('overlord.projectTickets.pageSize', String(pageSize))
  }, [pageSize])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, priorityFilter, serviceFilter, effortFilter, assignedToMe, testedFilter, includeSubtickets, search])

  useEffect(() => {
    if (!ticketsPage) return
    if (page > totalPages) setPage(totalPages)
  }, [ticketsPage, page, totalPages])

  const filteredTickets = ticketItems

  const hasLabels = ticketItems.some((t) => t.labels && t.labels.length > 0)
  const colsCls = hasLabels ? LIST_COLS_WITH_LABELS : LIST_COLS_NO_LABELS

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(col); setSortDir('asc') }
  }

  const sortedTickets = (() => {
    const d = sortDir === 'asc' ? 1 : -1
    return [...filteredTickets].sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'status':   cmp = (STATUS_SORT[a.status] ?? 99) - (STATUS_SORT[b.status] ?? 99); break
        case 'title':    cmp = a.title.localeCompare(b.title); break
        case 'priority': cmp = (PRIORITY_SORT[a.priority] ?? 99) - (PRIORITY_SORT[b.priority] ?? 99); break
        case 'effort':   cmp = (EFFORT_SORT[a.effort ?? ''] ?? 99) - (EFFORT_SORT[b.effort ?? ''] ?? 99); break
        case 'createdAt': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break
        case 'service':  cmp = (a.service?.name ?? '').localeCompare(b.service?.name ?? ''); break
        case 'labels':   cmp = (a.labels?.length ?? 0) - (b.labels?.length ?? 0); break
      }
      return cmp * d
    })
  })()

  const statusCounts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = ticketItems.filter((t) => t.status === s).length
    return acc
  }, {} as Record<string, number>)

  const assignedToMeCount = ticketItems.filter((t) => t.assigneeId === session?.user?.id).length

  // Build assignee options: project owner + members
  const assigneeOptions: UserSummary[] = []
  if (project?.owner) assigneeOptions.push(project.owner)
  for (const m of members) {
    if (!assigneeOptions.find((u) => u.id === m.user.id)) assigneeOptions.push(m.user)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <Link href={`/projects/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">
            {project?.name} — Tickets
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalTickets} ticket{totalTickets !== 1 ? 's' : ''}
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center rounded-md border p-0.5 gap-0.5">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode('grid')}
            title="Grid"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode('list')}
            title="List"
          >
            <LayoutList className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href={`/projects/${id}/labels`}>
            <Tag className="h-3.5 w-3.5" />
            Labels
          </Link>
        </Button>
        <Button onClick={() => setOpen(true)} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New Ticket
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 flex-wrap border-b pb-3">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            statusFilter === 'ALL'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          All
          <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-xs leading-none">
            {totalTickets}
          </span>
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              statusFilter === s
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <StatusIcon status={s} className="h-3.5 w-3.5" />
            {TICKET_STATUS_LABELS[s]}
            {statusCounts[s] > 0 && (
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-xs leading-none',
                statusFilter === s ? 'bg-background/20' : 'bg-muted',
              )}>
                {statusCounts[s]}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search tickets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAssignedToMe((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 h-8 rounded-md border px-3 text-sm font-medium transition-colors shrink-0',
            assignedToMe
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-input bg-background text-muted-foreground hover:bg-muted',
          )}
        >
          <UserCheck className="h-3.5 w-3.5" />
          On me
          <span className={cn(
            'rounded-full px-1.5 py-0.5 text-xs leading-none',
            assignedToMe ? 'bg-background/20' : 'bg-muted',
          )}>
            {assignedToMeCount}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Tested:</span>
          <Select value={testedFilter} onValueChange={(v) => { setTestedFilter(v); setPage(1) }}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="TESTED">Tested</SelectItem>
              <SelectItem value="UNTESTED">Untested</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          onClick={() => setIncludeSubtickets((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 h-8 rounded-md border px-3 text-sm font-medium transition-colors shrink-0',
            includeSubtickets
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-input bg-background text-muted-foreground hover:bg-muted',
          )}
        >
          Subtickets
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Priority:</span>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All priorities</SelectItem>
              {Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Effort:</span>
          <Select value={effortFilter} onValueChange={setEffortFilter}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue placeholder="All efforts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All efforts</SelectItem>
              <SelectItem value="__none__">Not set</SelectItem>
              {Object.entries(TICKET_EFFORT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Service:</span>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue placeholder="All services" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All services</SelectItem>
              <SelectItem value="__none__">No service</SelectItem>
              {services.map((service) => (
                <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── GRID VIEW ── */}
      {viewMode === 'grid' && (
        isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map((i) => <div key={i} className="h-36 bg-muted rounded animate-pulse" />)}
          </div>
        ) : filteredTickets.length === 0 ? (
          <EmptyState onNew={() => setOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                assigneeOptions={assigneeOptions}
                services={services}
                onAssign={(assigneeId) => updateMutation.mutate({ ticketId: ticket.id, patch: { assigneeId: assigneeId || null } })}
                onServiceAssign={(serviceId) => updateMutation.mutate({ ticketId: ticket.id, patch: { serviceId: serviceId || null } })}
              />
            ))}
          </div>
        )
      )}

      {/* ── LIST VIEW ── */}
      {viewMode === 'list' && (
        isLoading ? (
          <div className="space-y-2">
            {[1,2,3,4].map((i) => <div key={i} className="h-14 bg-muted rounded animate-pulse" />)}
          </div>
        ) : filteredTickets.length === 0 ? (
          <EmptyState onNew={() => setOpen(true)} />
        ) : (
          <div className="rounded-lg border divide-y overflow-hidden">
            <div className={cn('hidden md:grid items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/40', colsCls)}>
              <SortHeader label="Status" col="status" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Title" col="title" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              {hasLabels && <SortHeader label="Labels" col="labels" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />}
              <SortHeader label="Priority" col="priority" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Effort" col="effort" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Created" col="createdAt" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Service" col="service" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <span className="text-right">Assignee</span>
            </div>
            {sortedTickets.map((ticket) => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                assigneeOptions={assigneeOptions}
                showLabels={hasLabels}
                colsCls={colsCls}
                onAssign={(assigneeId) => updateMutation.mutate({ ticketId: ticket.id, patch: { assigneeId: assigneeId || null } })}
              />
            ))}
          </div>
        )
      )}

      <DataPaginator
        page={page}
        pageSize={pageSize}
        total={totalTickets}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={(nextSize) => {
          setPageSize(nextSize)
          setPage(1)
        }}
      />

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <FormLabel htmlFor="title">Title</FormLabel>
              <Input
                id="title"
                placeholder="Fix login redirect bug"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <FormLabel htmlFor="description">Description</FormLabel>
              <Textarea
                id="description"
                placeholder="Describe the issue or task…"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <FormLabel>Priority</FormLabel>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent position="popper" side="bottom" sideOffset={6} className="z-[120] bg-popover">
                    {Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <span className="flex items-center gap-2">
                          <PriorityIcon priority={value} className="h-3.5 w-3.5" />
                          {label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FormLabel>Status</FormLabel>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent position="popper" side="bottom" sideOffset={6} className="z-[120] bg-popover">
                    {Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <span className="flex items-center gap-2">
                          <StatusIcon status={value} className="h-3.5 w-3.5" />
                          {label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <FormLabel>Effort</FormLabel>
              <Select value={form.effort || '__none__'} onValueChange={(v) => setForm((f) => ({ ...f, effort: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={6} className="z-[120] bg-popover">
                  <SelectItem value="__none__">Not set</SelectItem>
                  {Object.entries(TICKET_EFFORT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <FormLabel>Assign to</FormLabel>
              <Select
                value={form.assigneeId || '__none__'}
                onValueChange={(v) => setForm((f) => ({ ...f, assigneeId: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={6} className="z-[120] bg-popover">
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {assigneeOptions.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <span className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          {u.image && <AvatarImage src={u.image} />}
                          <AvatarFallback className="text-[10px]">{toInitials(u)}</AvatarFallback>
                        </Avatar>
                        {u.name ?? u.email}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <FormLabel htmlFor="parentTicketId">Parent Ticket ID (optional)</FormLabel>
              <Input
                id="parentTicketId"
                placeholder="Leave empty for top-level ticket"
                value={form.parentTicketId}
                onChange={(e) => setForm((f) => ({ ...f, parentTicketId: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <FormLabel>Service (optional)</FormLabel>
              <Select
                value={form.serviceId || '__none__'}
                onValueChange={(v) => setForm((f) => ({ ...f, serviceId: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No service" />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={6} className="z-[120] bg-popover">
                  <SelectItem value="__none__">No service</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.title || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AssigneePopover({
  current,
  options,
  onAssign,
}: {
  current: UserSummary | null
  options: UserSummary[]
  onAssign: (id: string) => void
}) {
  return (
    // stopPropagation so clicking inside a <Link> card doesn't navigate
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Assign"
          >
            {current ? (
              <Avatar className="h-5 w-5">
                {current.image && <AvatarImage src={current.image} />}
                <AvatarFallback className="text-[10px]">{toInitials(current)}</AvatarFallback>
              </Avatar>
            ) : (
              <UserCircle2 className="h-4 w-4" />
            )}
            <span className="hidden sm:inline truncate max-w-[80px]">
              {current ? (current.name ?? current.email) : 'Unassigned'}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onAssign('')}>
            <UserCircle2 className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
            Unassigned
          </DropdownMenuItem>
          {options.map((u) => (
            <DropdownMenuItem key={u.id} onClick={() => onAssign(u.id)}>
              <Avatar className="h-5 w-5 mr-2 shrink-0">
                {u.image && <AvatarImage src={u.image} />}
                <AvatarFallback className="text-[10px]">{toInitials(u)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{u.name ?? u.email}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function TicketCard({
  ticket,
  assigneeOptions,
  services,
  onAssign,
  onServiceAssign,
}: {
  ticket: Ticket
  assigneeOptions: UserSummary[]
  services: Service[]
  onAssign: (id: string) => void
  onServiceAssign: (id: string) => void
}) {
  const firstImage = ticket.attachments?.find((a) => a.mimeType.startsWith('image/'))
  return (
    <Card className="hover:shadow-sm transition-shadow cursor-pointer hover:border-primary/40 group">
      <Link href={`/tickets/${ticket.id}`} className="block">
        {firstImage && (
          <div className="w-full h-32 overflow-hidden rounded-t-lg">
            <img
              src={`data:${firstImage.mimeType};base64,${firstImage.data}`}
              alt={firstImage.filename}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <CardContent className="p-3 space-y-2.5">
          <p className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {ticket.title}
          </p>
          {ticket.labels && ticket.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {ticket.labels.map(({ label }) => (
                <LabelBadge key={label.id} label={label} />
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <StatusBadge status={ticket.status} />
              {ticket.tested && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600" title="Tested">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Tested
                </span>
              )}
            </div>
            <PriorityBadge priority={ticket.priority} />
            {ticket.effort && (
              <span className="text-xs text-muted-foreground">{TICKET_EFFORT_LABELS[ticket.effort] ?? ticket.effort}</span>
            )}
            {ticket._count && ticket._count.subTickets > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">
                {ticket._count.subTickets} sub
              </span>
            )}
          </div>
        </CardContent>
      </Link>
      <CardContent className="pt-0 pb-3 px-3">
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-xs text-muted-foreground">{formatRelativeTime(ticket.createdAt)}</span>
          <AssigneePopover
            current={ticket.assignee ?? null}
            options={assigneeOptions}
            onAssign={onAssign}
          />
        </div>
        <div className="mt-2">
          <Select
            value={ticket.serviceId ?? '__none__'}
            onValueChange={(v) => onServiceAssign(v === '__none__' ? '' : v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="No service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No service</SelectItem>
              {services.map((service) => (
                <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}

function SortHeader({ label, col, sortBy, sortDir, onSort }: {
  label: string; col: string; sortBy: string; sortDir: 'asc' | 'desc'; onSort: (c: string) => void
}) {
  const active = sortBy === col
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={cn('flex items-center gap-1 transition-colors hover:text-foreground', active && 'text-foreground')}
    >
      {label}
      {active
        ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
        : <ArrowUpDown className="h-3 w-3 opacity-40" />}
    </button>
  )
}

function TicketRow({
  ticket,
  assigneeOptions,
  showLabels,
  colsCls,
  onAssign,
}: {
  ticket: Ticket
  assigneeOptions: UserSummary[]
  showLabels: boolean
  colsCls: string
  onAssign: (id: string) => void
}) {
  return (
    <div className="px-4 py-3 hover:bg-muted/50 transition-colors">
      <div className={cn('md:grid md:items-center md:gap-2 flex items-center gap-3', colsCls)}>
        <Link href={`/tickets/${ticket.id}`} className="contents">
          <div className="flex items-center gap-1">
            <StatusBadge status={ticket.status} />
            {ticket.tested && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600" title="Tested">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Tested
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{ticket.title}</p>
            {ticket.description && (
              <p className="hidden sm:block text-xs text-muted-foreground line-clamp-1 lg:line-clamp-2">
                {ticket.description}
              </p>
            )}
          </div>
          {showLabels && (
            <div className="hidden md:flex items-center gap-1 min-w-0 overflow-hidden">
              {ticket.labels && ticket.labels.length > 0 ? ticket.labels.slice(0, 3).map(({ label }) => (
                <LabelBadge key={label.id} label={label} />
              )) : <span className="text-xs text-muted-foreground">None</span>}
            </div>
          )}
          <div className="hidden md:block">
            <PriorityBadge priority={ticket.priority} />
          </div>
          <span className="hidden md:block text-xs text-muted-foreground">
            {ticket.effort ? (TICKET_EFFORT_LABELS[ticket.effort] ?? ticket.effort) : '—'}
          </span>
          <span className="hidden md:block text-xs text-muted-foreground">
            {formatRelativeTime(ticket.createdAt)}
          </span>
          <span className="hidden md:block text-xs text-muted-foreground truncate">
            {ticket.service?.name ?? 'No service'}
          </span>
        </Link>
        <div className="ml-auto md:ml-0 md:justify-self-end">
          <AssigneePopover current={ticket.assignee ?? null} options={assigneeOptions} onAssign={onAssign} />
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-muted-foreground mb-3">No tickets match this filter.</p>
      <Button variant="outline" onClick={onNew}>Create ticket</Button>
    </div>
  )
}
