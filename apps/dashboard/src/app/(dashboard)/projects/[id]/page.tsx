'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import yaml from 'js-yaml'
import { createPatch } from 'diff'
import {
  FolderKanban,
  Ticket,
  Server,
  Tag,
  ArrowLeft,
  Github,
  Globe,
  Pencil,
  UserPlus,
  UserCircle2,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { buildProjectApiUrl, formatContextApiUrl, getStoredOverlordBaseUrl } from '@/lib/overlord-links'
import { formatRelativeTime } from '@/lib/utils'
import type {
  Project,
  Service,
  Ticket as TicketType,
  ProjectMember,
  ProjectKnowledgeVersion,
  UserSummary,
} from '@platform/shared-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { StatusBadge, PriorityBadge } from '@/components/tickets/ticket-meta'

type KnowledgeField = 'roadmap' | 'entityGraph' | 'readmeMd' | 'apiSpec'

const KNOWLEDGE_META: Record<KnowledgeField, { title: string; hint: string; placeholder: string }> = {
  roadmap: {
    title: 'Roadmap',
    hint: 'Milestones, quarters, dependencies, and status updates.',
    placeholder: 'Q3\n- Ship OAuth device flow\n- Migrate billing to usage tiers',
  },
  entityGraph: {
    title: 'Entity Graph',
    hint: 'Store Mermaid ERD/UML or plain-text relationship docs.',
    placeholder: 'erDiagram\n  USER ||--o{ PROJECT : owns\n  PROJECT ||--o{ TICKET : contains',
  },
  readmeMd: {
    title: 'README.md',
    hint: 'Architecture, local setup, and team conventions.',
    placeholder: '# Project README\n\n## Setup\n\n- pnpm install\n- pnpm dev',
  },
  apiSpec: {
    title: 'API Endpoints',
    hint: 'Service-level OpenAPI specs are source-of-truth; project spec should be composed from services.',
    placeholder: 'GET /api/health\nGET /api/projects/:id\nPOST /api/tickets',
  },
}

const METHOD_BADGE: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-700 border-emerald-300/40',
  POST: 'bg-blue-500/10 text-blue-700 border-blue-300/40',
  PUT: 'bg-amber-500/10 text-amber-700 border-amber-300/40',
  PATCH: 'bg-violet-500/10 text-violet-700 border-violet-300/40',
  DELETE: 'bg-rose-500/10 text-rose-700 border-rose-300/40',
}

type ParsedEndpoint = {
  method: string
  path: string
  summary?: string
  operationId?: string
  description?: string
  requestBody?: string
  responses?: string[]
}

type ParsedApiSpec = {
  title?: string
  version?: string
  endpoints: ParsedEndpoint[]
}

type RoadmapNode = {
  id: string
  title: string
  detail?: string
  status: 'done' | 'in_progress' | 'planned'
}

const SwaggerUI = dynamic<any>(() => import('swagger-ui-react'), { ssr: false })

const MERMAID_PREFIXES = [
  'graph',
  'flowchart',
  'erDiagram',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'journey',
  'gantt',
  'pie',
  'mindmap',
  'timeline',
  'quadrantChart',
]

function isMermaidSyntax(value: string) {
  const firstLine = value
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
  if (!firstLine) return false
  return MERMAID_PREFIXES.some((prefix) => firstLine.startsWith(prefix))
}

function inferMermaidGraphFromText(value: string): string | null {
  const normalized = normalizeMultilineContent(value)
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) return null

  const relationRows = lines
    .map((line) => {
      const cleaned = line.replace(/^[-*]\s*/, '')
      const relationMatch = /^([A-Za-z][A-Za-z0-9_ ]+)\s*(-->|->|=>|:|\|\|--o\{|\|\|--\|\{)\s*([A-Za-z][A-Za-z0-9_ ]+)(?:\s*:\s*(.+))?$/i.exec(cleaned)
      if (!relationMatch) return null

      const from = relationMatch[1].trim().replace(/\s+/g, '_').toUpperCase()
      const rawArrow = relationMatch[2]
      const to = relationMatch[3].trim().replace(/\s+/g, '_').toUpperCase()
      const label = relationMatch[4]?.trim()

      const arrow = rawArrow === ':' ? '-->' : rawArrow
      return `${from} ${arrow} ${to}${label ? ` : ${label}` : ''}`
    })
    .filter((row): row is string => Boolean(row))

  if (!relationRows.length) return null
  return ['flowchart LR', ...relationRows].join('\n')
}

function extractOpenApi(input: unknown): ParsedApiSpec | null {
  if (!input || typeof input !== 'object') return null
  const parsed = input as {
    info?: { title?: string; version?: string }
    paths?: Record<string, Record<string, { summary?: string; operationId?: string }>>
  }
  if (!parsed.paths || typeof parsed.paths !== 'object') return null

  const endpoints: ParsedEndpoint[] = []
  for (const [path, methods] of Object.entries(parsed.paths)) {
    for (const [method, detail] of Object.entries(methods ?? {})) {
      const methodUpper = method.toUpperCase()
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(methodUpper)) {
        continue
      }

      const requestBody = (detail as any)?.requestBody
      const requestBodyDescription =
        typeof requestBody?.description === 'string'
          ? requestBody.description
          : requestBody
            ? 'Request body defined'
            : undefined
      const responses = Object.keys((detail as any)?.responses ?? {})

      endpoints.push({
        method: methodUpper,
        path,
        summary: detail?.summary,
        operationId: detail?.operationId,
        description: (detail as any)?.description,
        requestBody: requestBodyDescription,
        responses,
      })
    }
  }

  return {
    title: parsed.info?.title,
    version: parsed.info?.version,
    endpoints,
  }
}

function parseOpenApiDocument(value: string): Record<string, unknown> | null {
  const normalized = normalizeMultilineContent(value).trim()
  if (!normalized) return null

  try {
    const parsed = JSON.parse(normalized)
    if (parsed && typeof parsed === 'object' && 'paths' in (parsed as Record<string, unknown>)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // fall through
  }

  try {
    const parsed = yaml.load(normalized)
    if (parsed && typeof parsed === 'object' && 'paths' in (parsed as Record<string, unknown>)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // fall through
  }

  return null
}

function parseApiSpec(value: string): ParsedApiSpec {
  const trimmed = normalizeMultilineContent(value).trim()
  if (!trimmed) return { endpoints: [] }

  try {
    const jsonParsed = JSON.parse(trimmed)
    const apiSpec = extractOpenApi(jsonParsed)
    if (apiSpec) return apiSpec
  } catch {
    // fall through
  }

  // Heuristic OpenAPI YAML fallback (handles malformed YAML blocks but valid path/method lines)
  const yamlLines = trimmed.split(/\r?\n/)
  let currentPath: string | null = null
  const yamlEndpoints: ParsedEndpoint[] = []
  for (const line of yamlLines) {
    const pathMatch = /^\s{0,6}(\/[^:]+):\s*$/.exec(line)
    if (pathMatch) {
      currentPath = pathMatch[1]
      continue
    }
    const methodMatch = /^\s{2,10}(get|post|put|patch|delete|options|head):\s*$/i.exec(line)
    if (methodMatch && currentPath) {
      yamlEndpoints.push({ method: methodMatch[1].toUpperCase(), path: currentPath })
    }
  }
  if (yamlEndpoints.length > 0) {
    return { endpoints: yamlEndpoints }
  }

  try {
    const yamlParsed = yaml.load(trimmed)
    const apiSpec = extractOpenApi(yamlParsed)
    if (apiSpec) return apiSpec
  } catch {
    // fall through
  }

  const endpoints = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+([^\s]+)(?:\s+-\s+(.+))?$/i.exec(line)
      if (!match) return null
      return {
        method: match[1].toUpperCase(),
        path: match[2],
        summary: match[3],
      } as ParsedEndpoint
    })
    .filter((endpoint): endpoint is ParsedEndpoint => Boolean(endpoint))

  return { endpoints }
}

function buildSyntheticOpenApi(parsed: ParsedApiSpec): Record<string, unknown> {
  const paths: Record<string, Record<string, Record<string, unknown>>> = {}

  for (const endpoint of parsed.endpoints) {
    const method = endpoint.method.toLowerCase()
    if (!paths[endpoint.path]) paths[endpoint.path] = {}
    paths[endpoint.path][method] = {
      summary: endpoint.summary,
      description: endpoint.description,
      operationId: endpoint.operationId,
      responses: (endpoint.responses ?? ['200']).reduce<Record<string, { description: string }>>((acc, code) => {
        acc[code] = { description: `${code} response` }
        return acc
      }, {}),
    }
  }

  return {
    openapi: '3.0.0',
    info: {
      title: parsed.title ?? 'Project API',
      version: parsed.version ?? '1.0.0',
    },
    paths,
  }
}

function normalizeMultilineContent(content: string) {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n')
}

function parseRoadmapNodes(content: string): RoadmapNode[] {
  const normalized = normalizeMultilineContent(content)
  const rawLines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => Boolean(line) && !/^#+\s*/.test(line) && !/^roadmap\b/i.test(line))

  const expandedLines = rawLines.length <= 1
    ? rawLines.flatMap((line) => line.split(/\s*;\s*|\s*\|\s*/).filter(Boolean))
    : rawLines

  return expandedLines
    .map((line, index) => {
      const normalized = line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '')
      let status: RoadmapNode['status'] = 'planned'
      let text = normalized

      if (/^\[x\]\s*/i.test(text) || /^done:\s*/i.test(text)) {
        status = 'done'
        text = text.replace(/^\[x\]\s*/i, '').replace(/^done:\s*/i, '')
      } else if (/^\[~\]\s*/i.test(text) || /^wip:\s*/i.test(text) || /^in-progress:\s*/i.test(text)) {
        status = 'in_progress'
        text = text.replace(/^\[~\]\s*/i, '').replace(/^wip:\s*/i, '').replace(/^in-progress:\s*/i, '')
      } else if (/^\[ \]\s*/.test(text)) {
        text = text.replace(/^\[ \]\s*/, '')
      }

      const [title, ...rest] = text.split(/\s+-\s+/)
      return {
        id: `${index}-${title}`,
        title: title?.trim() || `Milestone ${index + 1}`,
        detail: rest.join(' - ').trim() || undefined,
        status,
      }
    })
}

function serializeRoadmapNodes(nodes: RoadmapNode[]) {
  return nodes
    .map((node) => {
      const prefix = node.status === 'done' ? '[x]' : node.status === 'in_progress' ? '[~]' : '[ ]'
      return `${prefix} ${node.title}${node.detail ? ` - ${node.detail}` : ''}`
    })
    .join('\n')
}

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="text-2xl font-semibold mt-2 mb-3">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-semibold mt-4 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-lg font-medium mt-3 mb-1.5">{children}</h3>,
  p: ({ children }) => <p className="text-sm leading-6 mb-3">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 mb-3">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 mb-3">{children}</ol>,
  li: ({ children }) => <li className="text-sm leading-6">{children}</li>,
  code: ({ children, className }) => (
    <code className={`rounded bg-muted px-1.5 py-0.5 text-xs ${className ?? ''}`}>{children}</code>
  ),
  pre: ({ children }) => <pre className="rounded-md border bg-muted/20 p-3 overflow-auto text-xs mb-3">{children}</pre>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-border pl-3 italic text-muted-foreground mb-3">{children}</blockquote>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
      {children}
    </a>
  ),
}

function RoadmapGraph({ nodes }: { nodes: RoadmapNode[] }) {
  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">No roadmap milestones yet.</p>
  }

  return (
    <div className="space-y-3">
      {nodes.map((node, index) => {
        const isLast = index === nodes.length - 1
        const nodeClass =
          node.status === 'done'
            ? 'border-emerald-500 bg-emerald-500/15'
            : node.status === 'in_progress'
              ? 'border-blue-500 bg-blue-500/15'
              : 'border-slate-400 bg-slate-400/10'

        const badgeClass =
          node.status === 'done'
            ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
            : node.status === 'in_progress'
              ? 'bg-blue-500/10 text-blue-700 border-blue-500/30'
              : 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30'

        return (
          <div key={node.id} className="grid grid-cols-[24px_1fr] gap-3">
            <div className="flex flex-col items-center">
              <span className={`h-4 w-4 rounded-full border ${nodeClass}`} />
              {!isLast ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
            </div>
            <div className="rounded-lg border bg-card px-3 py-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium">{node.title}</p>
                <Badge variant="outline" className={badgeClass}>
                  {node.status === 'in_progress' ? 'In Progress' : node.status === 'done' ? 'Done' : 'Planned'}
                </Badge>
              </div>
              {node.detail ? <p className="mt-1 text-xs text-muted-foreground">{node.detail}</p> : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MermaidPreview({ chart }: { chart: string }) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const renderIdRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    let cancelled = false

    const render = async () => {
      try {
        const mermaidModule = await import('mermaid')
        const mermaid = mermaidModule.default
        mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'neutral' })
        const { svg: rendered } = await mermaid.render(renderIdRef.current, chart)
        if (!cancelled) {
          setSvg(rendered)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render Mermaid diagram')
          setSvg('')
        }
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [chart])

  if (error) {
    return <p className="text-sm text-destructive">Diagram render error: {error}</p>
  }

  if (!svg) {
    return <p className="text-sm text-muted-foreground">Rendering diagram...</p>
  }

  return <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('services')
  const [editOpen, setEditOpen] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [addServiceOpen, setAddServiceOpen] = useState(false)
  const [editingField, setEditingField] = useState<KnowledgeField | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', gitRepoUrl: '', websiteUrl: '' })
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false)
  const [deleteProjectNameInput, setDeleteProjectNameInput] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [serviceForm, setServiceForm] = useState({ name: '', description: '' })
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [serviceEditDrafts, setServiceEditDrafts] = useState<Record<string, { name: string; description: string; baseUrl: string; healthUrl: string }>>({})
  const [apiSpecTarget, setApiSpecTarget] = useState<string>('project')
  const [serviceSpecDrafts, setServiceSpecDrafts] = useState<Record<string, string>>({})
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [overlordBaseUrl, setOverlordBaseUrl] = useState('')
  const [selectedHistoryId, setSelectedHistoryId] = useState<Record<KnowledgeField, string | null>>({
    roadmap: null,
    entityGraph: null,
    readmeMd: null,
    apiSpec: null,
  })
  const [historyOpen, setHistoryOpen] = useState<Record<KnowledgeField, boolean>>({
    roadmap: false,
    entityGraph: false,
    readmeMd: false,
    apiSpec: false,
  })
  const [draggedRoadmapIndex, setDraggedRoadmapIndex] = useState<number | null>(null)
  const [knowledgeDrafts, setKnowledgeDrafts] = useState<Record<KnowledgeField, string>>({
    roadmap: '',
    entityGraph: '',
    readmeMd: '',
    apiSpec: '',
  })

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

  const { data: project, isLoading: loadingProject, isError: projectLoadError, error: projectError } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.get<Project>(`/projects/${id}`),
    enabled: !!id,
  })

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<UserSummary>('/users/me'),
  })

  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ['tickets', { projectId: id }],
    queryFn: () => api.get<TicketType[]>(`/tickets?projectId=${id}`),
    enabled: !!id,
  })

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['members', id],
    queryFn: () => api.get<ProjectMember[]>(`/projects/${id}/members`),
    enabled: !!id,
  })

  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ['services', { projectId: id }],
    queryFn: () => api.get<Service[]>(`/services?projectId=${id}`),
    enabled: !!id,
  })

  const { data: knowledgeHistory = [] } = useQuery({
    queryKey: ['projects', id, 'knowledge-history'],
    queryFn: () => api.get<ProjectKnowledgeVersion[]>(`/projects/${id}/knowledge/history`),
    enabled: !!id,
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<typeof editForm> & { name: string }) => api.patch<Project>(`/projects/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects', id] }); setEditOpen(false) },
  })

  const addMemberMutation = useMutation({
    mutationFn: (email: string) => api.post(`/projects/${id}/members`, { email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', id] })
      setAddMemberOpen(false)
      setMemberEmail('')
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => api.delete(`/projects/${id}/members/${memberId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['members', id] }) },
  })

  const createServiceMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string }) =>
      api.post<Service>('/services', {
        projectId: id,
        name: payload.name,
        slug: payload.name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-'),
        description: payload.description || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', { projectId: id }] })
      queryClient.invalidateQueries({ queryKey: ['projects', id] })
      setServiceForm({ name: '', description: '' })
      setAddServiceOpen(false)
    },
  })

  const deleteServiceMutation = useMutation({
    mutationFn: (serviceId: string) => api.delete(`/services/${serviceId}`),
    onSuccess: (_result, serviceId) => {
      queryClient.invalidateQueries({ queryKey: ['services', { projectId: id }] })
      queryClient.invalidateQueries({ queryKey: ['projects', id] })
      if (apiSpecTarget === serviceId) {
        setApiSpecTarget('project')
      }
      setServiceSpecDrafts((drafts) => {
        const next = { ...drafts }
        delete next[serviceId]
        return next
      })
    },
  })

  const saveServiceSpecMutation = useMutation({
    mutationFn: ({ serviceId, apiSpec }: { serviceId: string; apiSpec: string }) =>
      api.patch<Service>(`/services/${serviceId}`, { apiSpec }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', { projectId: id }] })
    },
  })

  const updateServiceMutation = useMutation({
    mutationFn: ({ serviceId, name, description, baseUrl, healthUrl }: { serviceId: string; name: string; description: string; baseUrl: string; healthUrl: string }) =>
      api.patch<Service>(`/services/${serviceId}`, {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        baseUrl: baseUrl.trim() || undefined,
        healthUrl: healthUrl.trim() || undefined,
      }),
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({ queryKey: ['services', { projectId: id }] })
      queryClient.invalidateQueries({ queryKey: ['projects', id] })
      setEditingServiceId(null)
    },
  })

  const saveKnowledgeMutation = useMutation({
    mutationFn: ({ field, content }: { field: KnowledgeField; content: string }) =>
      api.patch<Project>(`/projects/${id}/knowledge`, { [field]: content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', id] })
      queryClient.invalidateQueries({ queryKey: ['projects', id, 'knowledge-history'] })
      setEditingField(null)
    },
  })

  const deleteProjectMutation = useMutation({
    mutationFn: () => api.delete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      router.push('/projects')
    },
  })

  const restoreKnowledgeMutation = useMutation({
    mutationFn: ({ field, content }: { field: KnowledgeField; content: string }) =>
      api.patch<Project>(`/projects/${id}/knowledge`, { [field]: content }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', id] })
      queryClient.invalidateQueries({ queryKey: ['projects', id, 'knowledge-history'] })
      setKnowledgeDrafts((drafts) => ({ ...drafts, [variables.field]: variables.content }))
      setEditingField(null)
    },
  })

  useEffect(() => {
    if (!project) return
    setKnowledgeDrafts({
      roadmap: project.roadmap ?? '',
      entityGraph: project.entityGraph ?? '',
      readmeMd: project.readmeMd ?? '',
      apiSpec: project.apiSpec ?? '',
    })
  }, [project])

  useEffect(() => {
    if (apiSpecTarget === 'project') return
    const service = services.find((s) => s.id === apiSpecTarget)
    if (!service) {
      setApiSpecTarget('project')
      return
    }
    setServiceSpecDrafts((prev) => ({
      ...prev,
      [service.id]: prev[service.id] ?? (service.apiSpec ?? ''),
    }))
  }, [services, apiSpecTarget])

  useEffect(() => {
    setServiceEditDrafts((current) => {
      const next = { ...current }
      for (const service of services) {
        if (!next[service.id]) {
          next[service.id] = {
            name: service.name,
            description: service.description ?? '',
            baseUrl: service.baseUrl ?? '',
            healthUrl: service.healthUrl ?? '',
          }
        }
      }
      return next
    })
  }, [services])

  useEffect(() => {
    const tab = searchParams.get('tab')
    const specTarget = searchParams.get('specTarget')
    if (tab === 'apiSpec') {
      setActiveTab('apiSpec')
    }
    if (tab === 'apiSpec' && specTarget) {
      if (services.some((service) => service.id === specTarget)) {
        setApiSpecTarget(specTarget)
      }
    }
  }, [searchParams, services])

  useEffect(() => {
    setSelectedHistoryId((current) => {
      const next = { ...current }
      ;(['roadmap', 'entityGraph', 'readmeMd', 'apiSpec'] as KnowledgeField[]).forEach((section) => {
        if (next[section]) return
        const first = knowledgeHistory.find((entry) => entry.section === section)
        if (first) next[section] = first.id
      })
      return next
    })
  }, [knowledgeHistory])

  const openEdit = () => {
    if (!project) return
    setEditForm({
      name: project.name,
      description: project.description ?? '',
      gitRepoUrl: project.gitRepoUrl ?? '',
      websiteUrl: project.websiteUrl ?? '',
    })
    setEditOpen(true)
  }

  const copyLink = async (kind: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedLink(kind)
      setTimeout(() => setCopiedLink(null), 1200)
    } catch {
      // ignore clipboard errors in unsupported environments
    }
  }

  const clearCurrentApiSpec = () => {
    if (apiSpecTarget === 'project') {
      saveKnowledgeMutation.mutate({ field: 'apiSpec', content: '' })
      return
    }

    const selectedService = services.find((service) => service.id === apiSpecTarget)
    if (!selectedService) return
    saveServiceSpecMutation.mutate({ serviceId: selectedService.id, apiSpec: '' })
    setServiceSpecDrafts((drafts) => ({ ...drafts, [selectedService.id]: '' }))
  }

  const canDeleteProject =
    me?.id === project?.ownerId ||
    me?.role === 'ADMIN' ||
    me?.isProtected === true

  const handleDeleteProject = () => {
    if (!project || !canDeleteProject || deleteProjectMutation.isPending) return
    if (deleteProjectNameInput.trim() !== project.name) return
    deleteProjectMutation.mutate()
  }

  if (loadingProject) return <div className="animate-pulse h-8 w-48 bg-muted rounded" />
  if (projectLoadError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive">Could not load project</p>
        <p className="mt-1 text-xs text-muted-foreground">{(projectError as Error)?.message ?? 'Unknown API error'}</p>
      </div>
    )
  }
  if (!project) return <div className="text-muted-foreground">Project not found.</div>

  const toInitials = (nameOrEmail: string) => nameOrEmail.slice(0, 2).toUpperCase()
  const doneTickets = tickets.filter((t) => t.status === 'DONE').length
  const testedDoneTickets = tickets.filter((t) => t.status === 'DONE' && t.tested).length
  const doneUntestedTickets = Math.max(0, doneTickets - testedDoneTickets)
  const inReviewTickets = tickets.filter((t) => t.status === 'IN_REVIEW').length
  const totalTickets = tickets.length
  const donePct = totalTickets === 0 ? 0 : Math.round((doneUntestedTickets / totalTickets) * 100)
  const testedPct = totalTickets === 0 ? 0 : Math.round((testedDoneTickets / totalTickets) * 100)
  const inReviewPct = totalTickets === 0 ? 0 : Math.round((inReviewTickets / totalTickets) * 100)
  const progressPct = donePct + testedPct + inReviewPct
  const historyBySection = knowledgeHistory.reduce<Record<KnowledgeField, ProjectKnowledgeVersion[]>>(
    (acc, entry) => {
      const section = entry.section as KnowledgeField
      if (!acc[section]) return acc
      acc[section].push(entry)
      return acc
    },
    { roadmap: [], entityGraph: [], readmeMd: [], apiSpec: [] },
  )

  const renderKnowledgeView = (field: KnowledgeField, content: string) => {
    if (!content.trim()) {
      return <p className="text-sm text-muted-foreground">No content yet.</p>
    }

    if (field === 'readmeMd') {
      return (
        <article className="max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {normalizeMultilineContent(content)}
          </ReactMarkdown>
        </article>
      )
    }

    if (field === 'apiSpec') {
      const openApiDocument = parseOpenApiDocument(content)
      const parsed = parseApiSpec(content)
      if (!openApiDocument && parsed.endpoints.length === 0) {
        return (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Swagger Preview</p>
              <p className="text-xs text-muted-foreground">Could not parse this spec into Swagger. Showing raw content.</p>
            </div>
            <pre className="rounded-md border bg-muted/20 p-3 text-xs whitespace-pre-wrap">{content}</pre>
          </div>
        )
      }

      const specForUi = openApiDocument ?? buildSyntheticOpenApi(parsed)

      return (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Swagger Preview</p>
            <p className="text-xs text-muted-foreground">{parsed.endpoints.length} endpoint{parsed.endpoints.length === 1 ? '' : 's'} detected</p>
          </div>
          <div className="swagger-compact bg-background text-foreground rounded-md border p-2">
            <SwaggerUI
              spec={specForUi}
              docExpansion="list"
              displayOperationId
              defaultModelsExpandDepth={-1}
            />
          </div>
        </div>
      )
    }

    if (field === 'roadmap') {
      const nodes = parseRoadmapNodes(content)
      return <RoadmapGraph nodes={nodes} />
    }

    if (field === 'entityGraph' && isMermaidSyntax(content)) {
      const normalizedContent = normalizeMultilineContent(content)
      return (
        <div className="space-y-3">
          <MermaidPreview chart={normalizedContent} />
          <details className="rounded-md border bg-muted/10 p-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">Show source</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs">{normalizedContent}</pre>
          </details>
        </div>
      )
    }

    if (field === 'entityGraph') {
      const inferredGraph = inferMermaidGraphFromText(content)
      if (inferredGraph) {
        return (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/10 p-3">
              <p className="text-xs font-medium">Auto-converted relationship notes</p>
              <p className="text-xs text-muted-foreground mt-1">Converted plain-text relations into Mermaid flowchart syntax for rendering. Save as Mermaid for best results.</p>
            </div>
            <MermaidPreview chart={inferredGraph} />
            <details className="rounded-md border bg-muted/10 p-3">
              <summary className="cursor-pointer text-xs text-muted-foreground">Show source</summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs">{normalizeMultilineContent(content)}</pre>
            </details>
          </div>
        )
      }
    }

    return (
      <pre className="rounded-md border bg-muted/20 p-3 text-xs whitespace-pre-wrap">{content}</pre>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 mt-0.5 shrink-0">
          <Link href="/projects"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight truncate">{project.name}</h1>
            {project.websiteUrl && (
              <a href={project.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" title={project.websiteUrl}>
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <Badge variant="outline">{project.status}</Badge>
            <button
              onClick={openEdit}
              className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Edit project"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
          <code className="text-xs text-muted-foreground font-mono">{project.key}</code>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canDeleteProject && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setDeleteProjectNameInput('')
                setDeleteProjectOpen(true)
              }}
              disabled={deleteProjectMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${id}/labels`}>
              <Tag className="h-4 w-4 mr-2" />Labels
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/projects/${id}/tickets`}>
              <Ticket className="h-4 w-4 mr-2" />Tickets
            </Link>
          </Button>
        </div>
      </div>

      {project.description && <p className="text-muted-foreground">{project.description}</p>}
      {overlordBaseUrl && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Context API url</p>
          <div className="flex items-center gap-1.5 text-xs">
            <a
              href={buildProjectApiUrl(overlordBaseUrl, project.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 truncate text-muted-foreground hover:text-foreground underline underline-offset-2"
              title={buildProjectApiUrl(overlordBaseUrl, project.id)}
            >
              {formatContextApiUrl(buildProjectApiUrl(overlordBaseUrl, project.id))}
            </a>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => copyLink('project-api', buildProjectApiUrl(overlordBaseUrl, project.id))}
              title="Copy project API URL"
            >
              {copiedLink === 'project-api' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      )}
      {deleteProjectMutation.isError && (
        <p className="text-sm text-destructive">
          {(deleteProjectMutation.error as Error)?.message ?? 'Could not delete project'}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link href={`/projects/${id}/tickets`} className="block">
          <Card className="h-full hover:border-primary/40 transition-colors cursor-pointer">
            <CardContent className="h-full pt-4 pb-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Ticket className="h-4 w-4" />
                  <span className="text-xs">Tickets & Progress</span>
                </div>
                <p className="text-sm text-muted-foreground">{doneTickets}/{totalTickets} tickets</p>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full flex">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${testedPct}%` }} />
                  <div className="h-full bg-sky-400 transition-all" style={{ width: `${donePct}%` }} />
                  <div className="h-full bg-amber-500 transition-all" style={{ width: `${inReviewPct}%` }} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{progressPct}% complete ({doneTickets} done, {testedDoneTickets} tested{inReviewTickets > 0 ? `, ${inReviewTickets} in review` : ''})</p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> Tested</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-sky-400" /> Done</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-amber-500" /> In review</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className="h-full">
          <CardContent className="h-full pt-4 pb-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Globe className="h-4 w-4" />
              <span className="text-xs">Links</span>
            </div>
            {project.gitRepoUrl ? (
              <div className="flex items-center gap-1.5">
                <a
                  href={project.gitRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Github className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{project.gitRepoUrl.replace(/^https?:\/\//, '')}</span>
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => copyLink('repo', project.gitRepoUrl!)}
                  title="Copy GitHub URL"
                >
                  {copiedLink === 'repo' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ) : null}
            {project.websiteUrl ? (
              <div className="flex items-center gap-1.5">
                <a
                  href={project.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{project.websiteUrl.replace(/^https?:\/\//, '')}</span>
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => copyLink('website', project.websiteUrl!)}
                  title="Copy website URL"
                >
                  {copiedLink === 'website' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ) : null}
            {!project.gitRepoUrl && !project.websiteUrl && (
              <button
                onClick={openEdit}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
              >
                + Add repo / website URL
              </button>
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardContent className="h-full pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Server className="h-4 w-4" />
              <span className="text-xs">Services</span>
            </div>
            <p className="font-semibold truncate">{String(project._count?.services ?? 0)}</p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardContent className="h-full pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FolderKanban className="h-4 w-4" />
              <span className="text-xs">Owner</span>
            </div>
            <p className="font-semibold truncate">{project.owner.name ?? project.owner.email}</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="services">Services ({services.length})</TabsTrigger>
          <TabsTrigger value="tickets">Tickets ({tickets.length})</TabsTrigger>
          <TabsTrigger value="readmeMd">Readme</TabsTrigger>
          <TabsTrigger value="apiSpec">API Endpoints</TabsTrigger>
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="entityGraph">Entity Graph</TabsTrigger>
          <TabsTrigger value="members">Collaborators ({members.length})</TabsTrigger>
        </TabsList>

        {/* Tickets tab */}
        <TabsContent value="tickets" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button asChild size="sm" variant="outline">
              <Link href={`/projects/${id}/tickets`}>View all tickets</Link>
            </Button>
          </div>
          {loadingTickets ? (
            <div className="space-y-2">
              {[1,2,3].map((i) => <div key={i} className="h-14 bg-muted rounded animate-pulse" />)}
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No tickets yet.</div>
          ) : (
            <div className="rounded-lg border divide-y overflow-hidden">
              <div className="hidden md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,3fr)_minmax(0,1.4fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/40">
                <span>Status</span>
                <span>Title</span>
                <span>Severity</span>
                <span>Assignee</span>
                <span>Created</span>
              </div>
              {tickets.slice(0, 10).map((t) => (
                <Link key={t.id} href={`/tickets/${t.id}`}
                  className="px-4 py-3 hover:bg-muted/50 transition-colors block">
                  <div className="md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,3fr)_minmax(0,1.4fr)_minmax(0,2fr)_minmax(0,1fr)] md:items-center md:gap-2 flex items-center gap-3">
                    <StatusBadge status={t.status} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      {t.description && (
                        <p className="hidden sm:block text-xs text-muted-foreground truncate">
                          {t.description}
                        </p>
                      )}
                    </div>
                    <PriorityBadge priority={t.priority} />
                    <span className="hidden sm:flex items-center gap-2 min-w-[170px] md:min-w-0">
                    {t.assignee ? (
                      <>
                        <Avatar className="h-5 w-5">
                          {t.assignee.image && <AvatarImage src={t.assignee.image} />}
                          <AvatarFallback className="text-[10px]">
                            {toInitials(t.assignee.name ?? t.assignee.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                          {t.assignee.name ?? t.assignee.email}
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <UserCircle2 className="h-3.5 w-3.5" />
                        Unassigned
                      </span>
                    )}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(t.createdAt)}</span>
                  </div>
                </Link>
              ))}
              {tickets.length > 10 && (
                <Link href={`/projects/${id}/tickets`}
                  className="flex items-center justify-center px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
                  +{tickets.length - 10} more tickets
                </Link>
              )}
            </div>
          )}
        </TabsContent>

        {/* Services tab */}
        <TabsContent value="services" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => setAddServiceOpen(true)}
            >
              Add service
            </Button>
          </div>

          <Card>
            <CardContent className="pt-4">
              {loadingServices ? (
                <p className="text-sm text-muted-foreground">Loading services...</p>
              ) : services.length === 0 ? (
                <p className="text-sm text-muted-foreground">No services yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {services.map((service) => {
                    const isEditingSvc = editingServiceId === service.id
                    const draft = serviceEditDrafts[service.id]
                    return (
                    <div key={service.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {isEditingSvc ? (
                            <Input
                              className="h-7 text-sm font-medium"
                              value={draft?.name ?? service.name}
                              onChange={(e) => setServiceEditDrafts((d) => ({ ...d, [service.id]: { ...d[service.id], name: e.target.value } }))}
                            />
                          ) : (
                            <p className="text-sm font-medium truncate">{service.name}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px]">{service.slug}</Badge>
                          {isEditingSvc ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingServiceId(null)}
                                disabled={updateServiceMutation.isPending}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                disabled={updateServiceMutation.isPending}
                                onClick={() => {
                                  const d = serviceEditDrafts[service.id]
                                  updateServiceMutation.mutate({
                                    serviceId: service.id,
                                    name: d?.name ?? service.name,
                                    description: d?.description ?? '',
                                    baseUrl: d?.baseUrl ?? '',
                                    healthUrl: d?.healthUrl ?? '',
                                  })
                                }}
                              >
                                {updateServiceMutation.isPending ? 'Saving…' : 'Save'}
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                title="Edit service"
                                onClick={() => {
                                  setServiceEditDrafts((d) => ({
                                    ...d,
                                    [service.id]: {
                                      name: service.name,
                                      description: service.description ?? '',
                                      baseUrl: service.baseUrl ?? '',
                                      healthUrl: service.healthUrl ?? '',
                                    },
                                  }))
                                  setEditingServiceId(service.id)
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                title="Delete service"
                                disabled={deleteServiceMutation.isPending}
                                onClick={() => {
                                  if (!window.confirm(`Delete service "${service.name}"?`)) return
                                  deleteServiceMutation.mutate(service.id)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {isEditingSvc ? (
                        <Textarea
                          className="mt-2 text-xs"
                          rows={2}
                          placeholder="Description (optional)"
                          value={draft?.description ?? ''}
                          onChange={(e) => setServiceEditDrafts((d) => ({ ...d, [service.id]: { ...d[service.id], description: e.target.value } }))}
                        />
                      ) : service.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">{service.description}</p>
                      ) : null}

                      <div className="mt-3 space-y-2">
                        <div className="space-y-1">
                          <Label className="block text-xs text-muted-foreground">Base URL</Label>
                          {isEditingSvc ? (
                            <Input
                              placeholder="https://service.example.com"
                              value={draft?.baseUrl ?? ''}
                              onChange={(e) => setServiceEditDrafts((d) => ({ ...d, [service.id]: { ...d[service.id], baseUrl: e.target.value } }))}
                            />
                          ) : service.baseUrl ? (
                            <div className="inline-flex items-center gap-1 max-w-full">
                              <a href={service.baseUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground font-mono hover:text-primary underline underline-offset-2 break-all">{service.baseUrl}</a>
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyLink(`svc-${service.id}-base`, service.baseUrl!)} title="Copy URL">
                                {copiedLink === `svc-${service.id}-base` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground font-mono"><span className="italic opacity-50">not set</span></p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="block text-xs text-muted-foreground">Health URL</Label>
                          {isEditingSvc ? (
                            <Input
                              placeholder="https://service.example.com/health"
                              value={draft?.healthUrl ?? ''}
                              onChange={(e) => setServiceEditDrafts((d) => ({ ...d, [service.id]: { ...d[service.id], healthUrl: e.target.value } }))}
                            />
                          ) : service.healthUrl ? (
                            <div className="inline-flex items-center gap-1 max-w-full">
                              <a href={service.healthUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground font-mono hover:text-primary underline underline-offset-2 break-all">{service.healthUrl}</a>
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyLink(`svc-${service.id}-health`, service.healthUrl!)} title="Copy URL">
                                {copiedLink === `svc-${service.id}-health` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground font-mono"><span className="italic opacity-50">not set</span></p>
                          )}
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
              )}
              {deleteServiceMutation.isError ? (
                <p className="mt-3 text-sm text-destructive">
                  {(deleteServiceMutation.error as Error)?.message ?? 'Failed to delete service'}
                </p>
              ) : null}
              {updateServiceMutation.isError ? (
                <p className="mt-2 text-sm text-destructive">
                  {(updateServiceMutation.error as Error)?.message ?? 'Failed to save service'}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Members/collaborators tab */}
        <TabsContent value="members" className="mt-4">
          <div className="flex justify-end mb-3">
            {(me?.id === project.ownerId || me?.role === 'ADMIN' || me?.role === 'MODERATOR' || me?.isProtected === true) && (
              <Button size="sm" onClick={() => setAddMemberOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />Add collaborator
              </Button>
            )}
          </div>

          {/* Owner row */}
          <div className="rounded-lg border divide-y overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <Avatar className="h-8 w-8">
                {project.owner.image && <AvatarImage src={project.owner.image} />}
                <AvatarFallback>{(project.owner.name ?? project.owner.email).slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{project.owner.name ?? project.owner.email}</p>
                <p className="text-xs text-muted-foreground">{project.owner.email}</p>
              </div>
              <Badge>Owner</Badge>
            </div>

            {loadingMembers ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">Loading…</div>
            ) : members.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                No collaborators yet. Add people by email.
              </div>
            ) : (
              members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar className="h-8 w-8">
                    {m.user.image && <AvatarImage src={m.user.image} />}
                    <AvatarFallback>{(m.user.name ?? m.user.email).slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{m.user.name ?? m.user.email}</p>
                    <p className="text-xs text-muted-foreground">{m.user.email}</p>
                  </div>
                  <Badge variant="secondary">{m.role}</Badge>
                  <button
                    onClick={() => removeMemberMutation.mutate(m.userId)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {(['roadmap', 'entityGraph', 'readmeMd', 'apiSpec'] as KnowledgeField[]).map((field) => {
          const meta = KNOWLEDGE_META[field]
          const isSaving = saveKnowledgeMutation.isPending && saveKnowledgeMutation.variables?.field === field
          const apiSpecService = field === 'apiSpec' && apiSpecTarget !== 'project'
            ? services.find((service) => service.id === apiSpecTarget) ?? null
            : null
          const activeContent = field === 'apiSpec'
            ? apiSpecService
              ? (serviceSpecDrafts[apiSpecService.id] ?? apiSpecService.apiSpec ?? '')
              : knowledgeDrafts[field]
            : knowledgeDrafts[field]
          const isEditing = editingField === field
          const isFramelessField = field === 'apiSpec' || field === 'roadmap' || field === 'entityGraph'
          const sectionHistory = apiSpecService ? [] : historyBySection[field]
          const selectedEntry = sectionHistory.find((entry) => entry.id === selectedHistoryId[field]) ?? null
          const currentContent = normalizeMultilineContent(
            field === 'apiSpec' && apiSpecService ? (apiSpecService.apiSpec ?? '') : (project[field] ?? ''),
          )
          const unifiedDiff = selectedEntry
            ? createPatch(
                `${field}.md`,
                normalizeMultilineContent(selectedEntry.content),
                currentContent,
                `history:${selectedEntry.id}`,
                'current',
                { context: 3 },
              )
            : ''
          const roadmapDraftNodes = parseRoadmapNodes(knowledgeDrafts.roadmap)

          return (
            <TabsContent key={field} value={field} className="mt-4 space-y-4">
              <div className={isFramelessField ? 'space-y-3' : 'rounded-lg border bg-card p-4 space-y-3'}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-medium">{meta.title}</p>
                    <p className="text-xs text-muted-foreground">{meta.hint}</p>
                    {field === 'apiSpec' && apiSpecService ? (
                      <p className="text-xs text-muted-foreground mt-1">Editing service spec for {apiSpecService.name}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {field === 'apiSpec' ? (
                      <Select value={apiSpecTarget} onValueChange={setApiSpecTarget}>
                        <SelectTrigger className="h-8 w-[220px]">
                          <SelectValue placeholder="Select spec source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="project">Project API spec</SelectItem>
                          {services.map((service) => (
                            <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (field === 'apiSpec' && apiSpecService) {
                              setServiceSpecDrafts((drafts) => ({
                                ...drafts,
                                [apiSpecService.id]: apiSpecService.apiSpec ?? '',
                              }))
                            } else {
                              setKnowledgeDrafts((drafts) => ({ ...drafts, [field]: project[field] ?? '' }))
                            }
                            setEditingField(null)
                          }}
                          disabled={isSaving || saveServiceSpecMutation.isPending}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (field === 'apiSpec' && apiSpecService) {
                              saveServiceSpecMutation.mutate({
                                serviceId: apiSpecService.id,
                                apiSpec: serviceSpecDrafts[apiSpecService.id] ?? '',
                              })
                              setEditingField(null)
                            } else {
                              saveKnowledgeMutation.mutate({ field, content: knowledgeDrafts[field] })
                            }
                          }}
                          disabled={isSaving || saveServiceSpecMutation.isPending}
                        >
                          {(isSaving || saveServiceSpecMutation.isPending) ? 'Saving…' : 'Save'}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setEditingField(field)}>
                        Edit
                      </Button>
                    )}
                    {field === 'apiSpec' ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={saveKnowledgeMutation.isPending || saveServiceSpecMutation.isPending}
                        onClick={() => {
                          const targetLabel = apiSpecTarget === 'project' ? 'project API spec' : 'service API spec'
                          if (!window.confirm(`Delete ${targetLabel}? This will clear the spec content.`)) return
                          clearCurrentApiSpec()
                        }}
                      >
                        Delete Spec
                      </Button>
                    ) : null}
                  </div>
                </div>

                {isEditing ? (
                  field === 'roadmap' ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">
                          One line per milestone. Prefix with [x], [~], or [ ] for status.
                        </p>
                        <div className="mb-3 space-y-2 rounded-md border bg-muted/10 p-2">
                          {roadmapDraftNodes.map((node, index) => (
                            <div
                              key={node.id}
                              draggable
                              onDragStart={() => setDraggedRoadmapIndex(index)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => {
                                if (draggedRoadmapIndex === null || draggedRoadmapIndex === index) return
                                const next = [...roadmapDraftNodes]
                                const [moved] = next.splice(draggedRoadmapIndex, 1)
                                next.splice(index, 0, moved)
                                setKnowledgeDrafts((drafts) => ({
                                  ...drafts,
                                  roadmap: serializeRoadmapNodes(next),
                                }))
                                setDraggedRoadmapIndex(null)
                              }}
                              className="cursor-grab rounded border bg-background px-2 py-1.5 text-xs"
                              title="Drag to reorder"
                            >
                              {node.title}
                            </div>
                          ))}
                        </div>
                        <Textarea
                          rows={16}
                          placeholder={meta.placeholder}
                          value={knowledgeDrafts[field]}
                          onChange={(e) => setKnowledgeDrafts((drafts) => ({ ...drafts, [field]: e.target.value }))}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="rounded-md border bg-background p-3">
                        <p className="text-xs text-muted-foreground mb-2">Live roadmap graph preview</p>
                        <RoadmapGraph nodes={parseRoadmapNodes(knowledgeDrafts[field])} />
                      </div>
                    </div>
                  ) : (
                    <Textarea
                      rows={16}
                      placeholder={meta.placeholder}
                      value={activeContent}
                      onChange={(e) => {
                        if (field === 'apiSpec' && apiSpecService) {
                          setServiceSpecDrafts((drafts) => ({ ...drafts, [apiSpecService.id]: e.target.value }))
                        } else {
                          setKnowledgeDrafts((drafts) => ({ ...drafts, [field]: e.target.value }))
                        }
                      }}
                      className="font-mono text-xs"
                    />
                  )
                ) : (
                  (() => {
                    const showServicesFallback =
                      field === 'apiSpec' &&
                      !apiSpecService &&
                      !activeContent.trim() &&
                      services.some((s) => s.apiSpec?.trim())
                    if (showServicesFallback) {
                      const withSpecs = services.filter((s) => s.apiSpec?.trim())
                      return (
                        <div className="rounded-md border bg-background p-4">
                          <p className="text-xs text-muted-foreground italic mb-4">No global API spec set. Showing individual service specs.</p>
                          {withSpecs.map((s, i) => (
                            <div key={s.id}>
                              {i > 0 && <div className="my-4 border-t" />}
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-semibold">{s.name}</span>
                                <Badge variant="outline" className="text-[10px]">{s.slug}</Badge>
                              </div>
                              {renderKnowledgeView('apiSpec', s.apiSpec ?? '')}
                            </div>
                          ))}
                        </div>
                      )
                    }
                    return (
                      <div className="rounded-md border bg-background p-4">
                        {renderKnowledgeView(field, activeContent)}
                      </div>
                    )
                  })()
                )}
              </div>

              <div className={isFramelessField ? 'space-y-3' : 'rounded-lg border bg-card p-4 space-y-3'}>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setHistoryOpen((current) => ({ ...current, [field]: !current[field] }))}
                    className="inline-flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                  >
                    {historyOpen[field] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Version History
                  </button>
                  <Badge variant="outline">{sectionHistory.length} versions</Badge>
                </div>

                {!historyOpen[field] ? (
                  <p className="text-sm text-muted-foreground">History is collapsed.</p>
                ) : apiSpecService ? (
                  <p className="text-sm text-muted-foreground">Service API spec history is not tracked yet.</p>
                ) : sectionHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No previous versions yet.</p>
                ) : (
                  <div className="space-y-2">
                    {sectionHistory.slice(0, 12).map((entry) => (
                      <div key={entry.id} className="rounded-md border bg-background px-3 py-2">
                        <p className="text-[11px] text-muted-foreground mb-1">{formatRelativeTime(entry.createdAt)}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">{entry.content}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-6 px-2"
                            disabled={restoreKnowledgeMutation.isPending}
                            onClick={() => restoreKnowledgeMutation.mutate({ field, content: entry.content })}
                          >
                            Restore
                          </Button>
                          <Button
                            size="sm"
                            variant={selectedHistoryId[field] === entry.id ? 'default' : 'outline'}
                            className="h-6 px-2"
                            onClick={() => setSelectedHistoryId((current) => ({ ...current, [field]: entry.id }))}
                          >
                            Diff vs current
                          </Button>
                        </div>
                      </div>
                    ))}

                    {selectedEntry ? (
                      <div className="rounded-md border bg-background p-2">
                        <p className="text-[11px] text-muted-foreground mb-1">Diff vs current version (git style)</p>
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-5 font-mono">
                          {unifiedDiff.split('\n').map((line, index) => (
                            <div
                              key={`${line}-${index}`}
                              className={
                                line.startsWith('@@')
                                  ? 'bg-amber-500/10 text-amber-700 px-1'
                                  : line.startsWith('+') && !line.startsWith('+++')
                                    ? 'bg-emerald-500/10 text-emerald-700 px-1'
                                    : line.startsWith('-') && !line.startsWith('---')
                                      ? 'bg-rose-500/10 text-rose-700 px-1'
                                      : line.startsWith('---') || line.startsWith('+++')
                                        ? 'text-muted-foreground px-1'
                                        : 'text-foreground/90 px-1'
                              }
                            >
                              {line || ' '}
                            </div>
                          ))}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </TabsContent>
          )
        })}
      </Tabs>

      {/* ── Edit dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit project</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea id="edit-desc" rows={3} value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-git">Git Repository URL</Label>
              <div className="relative">
                <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="edit-git" className="pl-9" placeholder="https://github.com/org/repo"
                  value={editForm.gitRepoUrl}
                  onChange={(e) => setEditForm((f) => ({ ...f, gitRepoUrl: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-web">Website URL</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="edit-web" className="pl-9" placeholder="https://myapp.com"
                  value={editForm.websiteUrl}
                  onChange={(e) => setEditForm((f) => ({ ...f, websiteUrl: e.target.value }))} />
              </div>
            </div>
          </div>
          {updateMutation.isError && (
            <p className="text-sm text-destructive">{(updateMutation.error as Error)?.message ?? 'Failed to save changes'}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate({
              name: editForm.name,
              description: editForm.description || undefined,
              gitRepoUrl: editForm.gitRepoUrl || undefined,
              websiteUrl: editForm.websiteUrl || undefined,
            })}
              disabled={!editForm.name || updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteProjectOpen} onOpenChange={setDeleteProjectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Delete project</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Type <span className="font-semibold text-foreground">{project.name}</span> to confirm deletion.
            </p>
            <Input
              placeholder="Project name"
              value={deleteProjectNameInput}
              onChange={(e) => setDeleteProjectNameInput(e.target.value)}
            />
            {deleteProjectMutation.isError ? (
              <p className="text-sm text-destructive">
                {(deleteProjectMutation.error as Error)?.message ?? 'Could not delete project'}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteProjectOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={deleteProjectMutation.isPending || deleteProjectNameInput.trim() !== project.name}
            >
              {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add collaborator dialog ── */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add collaborator</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="member-email">Email address</Label>
              <Input id="member-email" type="email" placeholder="user@example.com"
                value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
            </div>
            {addMemberMutation.isError && (
              <p className="text-sm text-destructive">
                {(addMemberMutation.error as Error)?.message ?? 'Failed to add member'}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
            <Button onClick={() => addMemberMutation.mutate(memberEmail)}
              disabled={!memberEmail || addMemberMutation.isPending}>
              {addMemberMutation.isPending ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add service dialog ── */}
      <Dialog open={addServiceOpen} onOpenChange={setAddServiceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add service</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="service-name">Name</Label>
              <Input
                id="service-name"
                placeholder="Gateway"
                value={serviceForm.name}
                onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-description">Description</Label>
              <Textarea
                id="service-description"
                rows={3}
                placeholder="Optional description"
                value={serviceForm.description}
                onChange={(e) => setServiceForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            {createServiceMutation.isError ? (
              <p className="text-sm text-destructive">
                {(createServiceMutation.error as Error)?.message ?? 'Failed to create service'}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddServiceOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createServiceMutation.mutate(serviceForm)}
              disabled={!serviceForm.name.trim() || createServiceMutation.isPending}
            >
              {createServiceMutation.isPending ? 'Creating…' : 'Create service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
