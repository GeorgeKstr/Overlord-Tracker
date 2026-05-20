'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeft,
  AlertCircle,
  MessageSquare,
  GitBranch,
  Tag,
  Trash2,
  Plus,
  UserCircle2,
  Paperclip,
  Check,
  Copy,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { buildProjectApiUrl, formatContextApiUrl, getStoredOverlordBaseUrl } from '@/lib/overlord-links'
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_BG,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_BG,
  TICKET_PRIORITY_COLORS,
  TICKET_EFFORT_LABELS,
  formatDate,
  formatRelativeTime,
  cn,
} from '@/lib/utils'
import type { TicketDetail, Ticket, Label, Comment, ProjectMember, UserSummary, Project, Service } from '@platform/shared-types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CommentList } from '@/components/tickets/comment-list'
import { CommentForm } from '@/components/tickets/comment-form'
import { LabelBadge } from '@/components/labels/label-badge'

const STATUS_BADGE_MAP: Record<
  string,
  'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive'
> = {
  OPEN: 'outline',
  IN_PROGRESS: 'default',
  IN_REVIEW: 'warning',
  DONE: 'success',
  CANCELLED: 'secondary',
}

export default function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session } = useSession()

  const [editingDescription, setEditingDescription] = useState(false)
  const [descDraft, setDescDraft] = useState('')
  const [addingLabel, setAddingLabel] = useState(false)
  const [overlordBaseUrl, setOverlordBaseUrl] = useState('')
  const [copiedApi, setCopiedApi] = useState(false)
  const attachFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const refresh = () => setOverlordBaseUrl(getStoredOverlordBaseUrl())
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('overlord-base-url-changed', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('overlord-base-url-changed', refresh)
    }
  }, [])

  // ── Queries ────────────────────────────────────────────────────────────────
  const {
    data: ticket,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['tickets', ticketId],
    queryFn: () => api.get<TicketDetail>(`/tickets/${ticketId}`),
  })

  const { data: projectLabels = [] } = useQuery({
    queryKey: ['labels', ticket?.projectId],
    queryFn: () => api.get<Label[]>(`/labels?projectId=${ticket!.projectId}`),
    enabled: !!ticket?.projectId,
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members', ticket?.projectId],
    queryFn: () => api.get<ProjectMember[]>(`/projects/${ticket!.projectId}/members`),
    enabled: !!ticket?.projectId,
  })

  const { data: project } = useQuery({
    queryKey: ['projects', ticket?.projectId],
    queryFn: () => api.get<Project>(`/projects/${ticket!.projectId}`),
    enabled: !!ticket?.projectId,
  })

  const { data: services = [] } = useQuery({
    queryKey: ['services', { projectId: ticket?.projectId }],
    queryFn: () => api.get<Service[]>(`/services?projectId=${ticket!.projectId}`),
    enabled: !!ticket?.projectId,
  })

  // ── Mutations ──────────────────────────────────────────────────────────────
  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['tickets'] })
    queryClient.invalidateQueries({ queryKey: ['projects', ticket?.projectId] })
  }

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Ticket>) => api.patch<Ticket>(`/tickets/${ticketId}`, data),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/tickets/${ticketId}`),
    onSuccess: () => router.back(),
  })

  const addCommentMutation = useMutation({
    mutationFn: (content: string) =>
      api.post<Comment>('/comments', { content, ticketId }),
    onSuccess: invalidate,
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/comments/${id}`),
    onSuccess: invalidate,
  })

  const addLabelMutation = useMutation({
    mutationFn: (labelId: string) =>
      api.post(`/labels/ticket/${ticketId}/label/${labelId}`, {}),
    onSuccess: () => {
      invalidate()
      setAddingLabel(false)
    },
  })

  const removeLabelMutation = useMutation({
    mutationFn: (labelId: string) =>
      api.delete(`/labels/ticket/${ticketId}/label/${labelId}`),
    onSuccess: invalidate,
  })

  const uploadAttachmentMutation = useMutation({
    mutationFn: (file: File) =>
      new Promise<void>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = async () => {
          try {
            const dataUrl = reader.result as string
            const base64 = dataUrl.split(',')[1]
            await api.post(`/tickets/${ticketId}/attachments`, {
              filename: file.name,
              mimeType: file.type,
              data: base64,
            })
            resolve()
          } catch (e) { reject(e) }
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      }),
    onSuccess: invalidate,
  })

  const deleteAttachmentMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/attachments/${id}`),
    onSuccess: invalidate,
  })

  // ── Helpers ────────────────────────────────────────────────────────────────
  const assignedLabelIds = new Set(ticket?.labels?.map((tl) => tl.label.id) ?? [])
  const availableLabels = projectLabels.filter((l) => !assignedLabelIds.has(l.id))

  // Build assignee options: project owner + members (deduped)
  const assigneeOptions: UserSummary[] = []
  if (project?.owner) assigneeOptions.push(project.owner)
  for (const m of members) {
    if (!assigneeOptions.find((u) => u.id === m.user.id)) assigneeOptions.push(m.user)
  }
  if (ticket?.assignee && !assigneeOptions.find((u) => u.id === ticket.assignee!.id)) {
    assigneeOptions.unshift(ticket.assignee)
  }

  function toInitials(user: UserSummary) {
    return (user.name ?? user.email).slice(0, 2).toUpperCase()
  }

  function startEditDescription() {
    setDescDraft(ticket?.description ?? '')
    setEditingDescription(true)
  }

  function saveDescription() {
    updateMutation.mutate({ description: descDraft })
    setEditingDescription(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-2/3 bg-muted rounded" />
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Ticket not found.{' '}
        <button type="button" onClick={() => router.back()} className="underline">
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0 mt-0.5"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold', TICKET_STATUS_BG[ticket.status])}>
              {TICKET_STATUS_LABELS[ticket.status]}
            </span>
            <span
              className={cn(
                'flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold',
                TICKET_PRIORITY_BG[ticket.priority],
              )}
            >
              <AlertCircle className="h-3 w-3" />
              {TICKET_PRIORITY_LABELS[ticket.priority]}
            </span>
            {ticket.parentTicketId && (
              <Link
                href={`/tickets/${ticket.parentTicketId}`}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <GitBranch className="h-3 w-3" />
                Sub-ticket
              </Link>
            )}
          </div>
          <h1 className="text-xl font-semibold leading-tight">{ticket.title}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Opened by{' '}
            <span className="font-medium">
              {ticket.author.name ?? ticket.author.email}
            </span>{' '}
            · {formatDate(ticket.createdAt)}
          </p>
          {overlordBaseUrl && (
            <div className="mt-1 space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Context API url</p>
              <div className="flex items-center gap-1.5 text-xs">
                <a
                  href={buildProjectApiUrl(overlordBaseUrl, ticket.projectId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 truncate text-muted-foreground hover:text-foreground underline underline-offset-2"
                  title={buildProjectApiUrl(overlordBaseUrl, ticket.projectId)}
                >
                  {formatContextApiUrl(buildProjectApiUrl(overlordBaseUrl, ticket.projectId))}
                </a>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(buildProjectApiUrl(overlordBaseUrl, ticket.projectId))
                      setCopiedApi(true)
                      setTimeout(() => setCopiedApi(false), 1500)
                    } catch {
                      // Ignore clipboard failures.
                    }
                  }}
                  title="Copy project API URL"
                >
                  {copiedApi ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
          onClick={() => {
            if (confirm('Delete this ticket? This cannot be undone.')) {
              deleteMutation.mutate()
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main column ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editingDescription ? (
                <div className="space-y-2">
                  <Textarea
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    rows={5}
                    className="resize-none text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingDescription(false)}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveDescription}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="text-sm text-foreground/80 min-h-[3rem] cursor-text rounded hover:bg-muted/50 p-2 -m-2 transition-colors"
                  onClick={startEditDescription}
                  title="Click to edit"
                >
                  {ticket.description ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_a]:text-primary [&_a]:underline">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {ticket.description}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">
                      No description. Click to add one.
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  Attachments
                  {(ticket.attachments?.length ?? 0) > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      {ticket.attachments!.length}
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  disabled={uploadAttachmentMutation.isPending}
                  onClick={() => attachFileRef.current?.click()}
                >
                  <Plus className="h-3 w-3" />
                  {uploadAttachmentMutation.isPending ? 'Uploading…' : 'Upload image'}
                </Button>
                <input
                  ref={attachFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadAttachmentMutation.mutate(file)
                    e.target.value = ''
                  }}
                />
              </div>
            </CardHeader>
            <CardContent>
              {(ticket.attachments?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No attachments yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ticket.attachments!.map((a) => (
                    <div key={a.id} className="group relative rounded-md overflow-hidden border bg-muted aspect-video">
                      <img
                        src={`data:${a.mimeType};base64,${a.data}`}
                        alt={a.filename}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <a
                          href={`data:${a.mimeType};base64,${a.data}`}
                          download={a.filename}
                          className="text-white hover:text-primary transition-colors"
                          title="Download"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Paperclip className="h-4 w-4" />
                        </a>
                        {(session?.user?.id === a.uploadedById) && (
                          <button
                            type="button"
                            title="Delete"
                            className="text-white hover:text-destructive transition-colors"
                            disabled={deleteAttachmentMutation.isPending}
                            onClick={() => deleteAttachmentMutation.mutate(a.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <p className="absolute bottom-0 left-0 right-0 px-1.5 py-1 text-[10px] text-white bg-black/60 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                        {a.filename}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {uploadAttachmentMutation.isError && (
                <p className="mt-2 text-xs text-destructive">
                  {(uploadAttachmentMutation.error as Error)?.message ?? 'Upload failed'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Subtickets */}
          {(ticket.subTickets?.length > 0 ||
            ticket._count?.subTickets !== undefined) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5" />
                  Sub-tickets
                  <Badge variant="secondary" className="text-xs ml-1">
                    {ticket.subTickets?.length ?? 0}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ticket.subTickets?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sub-tickets.</p>
                ) : (
                  <div className="divide-y">
                    {ticket.subTickets?.map((sub) => (
                      <Link
                        key={sub.id}
                        href={`/tickets/${sub.id}`}
                        className="flex items-center gap-3 py-2 hover:text-primary transition-colors"
                      >
                        <Badge
                          variant={STATUS_BADGE_MAP[sub.status] ?? 'outline'}
                          className="text-xs shrink-0"
                        >
                          {TICKET_STATUS_LABELS[sub.status]}
                        </Badge>
                        <span className="text-sm truncate">{sub.title}</span>
                        <span
                          className={cn(
                            'text-xs ml-auto shrink-0',
                            TICKET_PRIORITY_COLORS[sub.priority],
                          )}
                        >
                          {TICKET_PRIORITY_LABELS[sub.priority]}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Comments */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mb-3">
              <MessageSquare className="h-3.5 w-3.5" />
              Comments
              <Badge variant="secondary" className="text-xs ml-1">
                {ticket.comments?.length ?? 0}
              </Badge>
            </h2>
            <CommentList
              comments={ticket.comments ?? []}
              currentUserId={session?.user?.id}
              onDelete={(id) => deleteCommentMutation.mutate(id)}
            />
            <Separator className="my-4" />
            <CommentForm
              onSubmit={async (content) => { await addCommentMutation.mutateAsync(content) }}
            />
          </div>
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Metadata */}
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Created</span>
              <span>{formatDate(ticket.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>Updated</span>
              <span>{formatRelativeTime(ticket.updatedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>Author</span>
              <span className="text-foreground">
                {ticket.author.name ?? ticket.author.email}
              </span>
            </div>
            {ticket.assignee && (
              <div className="flex justify-between">
                <span>Assignee</span>
                <span className="text-foreground">
                  {ticket.assignee.name ?? ticket.assignee.email}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Project</span>
              <Link
                href={`/projects/${ticket.projectId}`}
                className="text-primary hover:underline"
              >
                View
              </Link>
            </div>
          </div>

          <Separator />

          {/* Status */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Status</p>
              <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold', TICKET_STATUS_BG[ticket.status])}>
                {TICKET_STATUS_LABELS[ticket.status]}
              </span>
            </div>
            <Select
              value={ticket.status}
              onValueChange={(v) => updateMutation.mutate({ status: v as any })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" sideOffset={6} className="z-[120] bg-popover">
                {Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Priority</p>
              <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold', TICKET_PRIORITY_BG[ticket.priority])}>
                <AlertCircle className="h-3 w-3" />
                {TICKET_PRIORITY_LABELS[ticket.priority]}
              </span>
            </div>
            <Select
              value={ticket.priority}
              onValueChange={(v) => updateMutation.mutate({ priority: v as any })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" sideOffset={6} className="z-[120] bg-popover">
                {Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignee */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Assignee</p>
            <Select
              value={ticket.assigneeId ?? '__none__'}
              onValueChange={(v) =>
                updateMutation.mutate({ assigneeId: v === '__none__' ? null : v } as any)
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" sideOffset={6} className="z-[120] bg-popover">
                <SelectItem value="__none__">
                  <span className="flex items-center gap-2">
                    <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                    Unassigned
                  </span>
                </SelectItem>
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

          {/* Service */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Service</p>
            <Select
              value={ticket.serviceId ?? '__none__'}
              onValueChange={(v) => updateMutation.mutate({ serviceId: v === '__none__' ? null : v } as any)}
            >
              <SelectTrigger className="h-8 text-sm">
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

          {/* Effort */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Effort</p>
            <Select
              value={ticket.effort ?? '__none__'}
              onValueChange={(v) => updateMutation.mutate({ effort: v === '__none__' ? null : v } as any)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" sideOffset={6} className="z-[120] bg-popover">
                <SelectItem value="__none__">Not set</SelectItem>
                {Object.entries(TICKET_EFFORT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tested */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Quality</p>
            <button
              type="button"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ tested: !ticket.tested } as any)}
              className={cn(
                'flex items-center gap-2 w-full rounded-md border px-3 py-2 text-sm transition-colors',
                ticket.tested
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'border-input bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              <span className={cn(
                'flex h-4 w-4 items-center justify-center rounded border transition-colors shrink-0',
                ticket.tested ? 'bg-emerald-500 border-emerald-500' : 'border-input',
              )}>
                {ticket.tested && <Check className="h-2.5 w-2.5 text-white" />}
              </span>
              Tested &amp; working
            </button>
          </div>

          {/* Labels */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Tag className="h-3 w-3" />
                Labels
              </p>
              {availableLabels.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setAddingLabel((v) => !v)}
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
            </div>

            {addingLabel && (
              <Select
                onValueChange={(labelId) => addLabelMutation.mutate(labelId)}
              >
                <SelectTrigger className="h-7 text-xs mb-2">
                  <SelectValue placeholder="Add label…" />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={6} className="z-[120] bg-popover">
                  {availableLabels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex flex-wrap gap-1.5">
              {ticket.labels?.length === 0 && !addingLabel && (
                <span className="text-xs text-muted-foreground">None</span>
              )}
              {ticket.labels?.map(({ label }) => (
                <LabelBadge
                  key={label.id}
                  label={label}
                  onRemove={() => removeLabelMutation.mutate(label.id)}
                />
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
