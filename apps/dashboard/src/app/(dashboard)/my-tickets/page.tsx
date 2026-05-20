'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  Search,
  X,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_EFFORT_LABELS,
  formatRelativeTime,
  cn,
} from '@/lib/utils'
import type { Ticket } from '@platform/shared-types'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge, PriorityBadge, StatusIcon } from '@/components/tickets/ticket-meta'
import { DataPaginator } from '@/components/pagination/data-paginator'

const ALL_STATUSES = ['OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'] as const

type PaginatedResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function MyTicketsPage() {
  const { data: session } = useSession()
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [priorityFilter, setPriorityFilter] = useState('ALL')
  const [projectFilter, setProjectFilter] = useState('ALL')
  const [serviceFilter, setServiceFilter] = useState('ALL')
  const [effortFilter, setEffortFilter] = useState('ALL')
  const [testedFilter, setTestedFilter] = useState('ALL')
  const [includeSubtickets, setIncludeSubtickets] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window === 'undefined') return 20
    const raw = Number(localStorage.getItem('overlord.myTickets.pageSize') ?? '20')
    return [10, 20, 50].includes(raw) ? raw : 20
  })

  useEffect(() => {
    localStorage.setItem('overlord.myTickets.pageSize', String(pageSize))
  }, [pageSize])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, priorityFilter, projectFilter, serviceFilter, effortFilter, testedFilter, includeSubtickets, search])

  const ticketsQuery = useQuery({
    queryKey: ['my-tickets', session?.user?.id, { page, pageSize, statusFilter, priorityFilter, projectFilter, serviceFilter, effortFilter, testedFilter, includeSubtickets, search }],
    queryFn: () => {
      const params = new URLSearchParams({
        assigneeId: session!.user!.id,
        page: String(page),
        pageSize: String(pageSize),
      })
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (priorityFilter !== 'ALL') params.set('priority', priorityFilter)
      if (projectFilter !== 'ALL') params.set('projectId', projectFilter)
      if (serviceFilter !== 'ALL') params.set('serviceId', serviceFilter)
      if (effortFilter !== 'ALL') params.set('effort', effortFilter)
      if (testedFilter === 'TESTED') params.set('tested', 'true')
      if (testedFilter === 'UNTESTED') params.set('tested', 'false')
      if (includeSubtickets) params.set('includeSubtickets', 'true')
      if (search.trim()) params.set('q', search.trim())
      return api.get<PaginatedResponse<Ticket>>(`/tickets?${params.toString()}`)
    },
    enabled: !!session?.user?.id,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  const tickets = ticketsQuery.data?.items ?? []
  const totalTickets = ticketsQuery.data?.total ?? 0
  const totalPages = ticketsQuery.data?.totalPages ?? 1
  const isLoading = ticketsQuery.isLoading

  useEffect(() => {
    if (!ticketsQuery.data) return
    if (page > totalPages) setPage(totalPages)
  }, [ticketsQuery.data, page, totalPages])

  const projectOptions = Array.from(
    new Map(
      tickets
        .filter((t) => t.project)
        .map((t) => [t.project!.id, { id: t.project!.id, name: t.project!.name, key: t.project!.key }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name))

  const serviceOptions = Array.from(
    new Map(
      tickets
        .filter((t) => t.service)
        .map((t) => [t.service!.id, { id: t.service!.id, name: t.service!.name }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name))

  const filtered = tickets

  const statusCounts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = tickets.filter((t) => t.status === s).length
    return acc
  }, {} as Record<string, number>)

  const sortedFiltered = [...filtered].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )

  const groupedTickets = sortedFiltered.reduce<Record<string, { id: string; name: string; key: string; tickets: Ticket[] }>>(
    (acc, ticket) => {
      const id = ticket.projectId
      if (!acc[id]) {
        acc[id] = {
          id,
          name: ticket.project?.name ?? ticket.projectId,
          key: ticket.project?.key ?? '—',
          tickets: [],
        }
      }
      acc[id].tickets.push(ticket)
      return acc
    },
    {},
  )

  const groupedList = Object.values(groupedTickets).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Tickets</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isLoading ? 'Loading…' : `${totalTickets} ticket${totalTickets !== 1 ? 's' : ''} assigned to you`}
        </p>
      </div>

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

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Project:</span>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-8 w-[200px]">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All projects</SelectItem>
              {projectOptions.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name} ({project.key})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
              {serviceOptions.map((service) => (
                <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
            'inline-flex items-center gap-1.5 h-8 rounded-md border px-3 text-sm font-medium transition-colors',
            includeSubtickets
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-input bg-background text-muted-foreground hover:bg-muted',
          )}
        >
          Subtickets
        </button>

      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-muted rounded animate-pulse" />)}
        </div>
      ) : ticketsQuery.isError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {(ticketsQuery.error as Error)?.message ?? 'Failed to load tickets. Please refresh.'}
        </div>
      ) : sortedFiltered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground mb-3">No tickets match this filter.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedList.map((group) => (
            <div key={group.id} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Link href={`/projects/${group.id}`} className="text-sm font-semibold hover:underline">
                  {group.name}
                </Link>
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {group.key}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {group.tickets.length} ticket{group.tickets.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="rounded-lg border divide-y overflow-hidden">
                <div className="hidden md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,3fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.3fr)] items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/40">
                  <span>Status</span>
                  <span>Title</span>
                  <span>Priority</span>
                  <span>Effort</span>
                  <span>Updated</span>
                  <span>Service</span>
                </div>
                {group.tickets.map((ticket) => (
                  <div key={ticket.id} className="px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className="md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,3fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.3fr)] md:items-center md:gap-2 flex items-center gap-3">
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

                        <div className="hidden md:block">
                          <PriorityBadge priority={ticket.priority} />
                        </div>

                        <span className="hidden md:block text-xs text-muted-foreground">
                          {ticket.effort ? (TICKET_EFFORT_LABELS[ticket.effort] ?? ticket.effort) : '—'}
                        </span>

                        <span className="hidden md:block text-xs text-muted-foreground">
                          {formatRelativeTime(ticket.updatedAt)}
                        </span>

                        <span className="hidden md:block text-xs text-muted-foreground truncate">
                          {ticket.service?.name ?? 'No service'}
                        </span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
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
    </div>
  )
}
