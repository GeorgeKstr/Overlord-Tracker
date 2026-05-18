// Shared TypeScript types used across the platform.
// These mirror the Prisma models but are framework-agnostic.

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED' | 'INACTIVE'
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED'
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type ServiceStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN'

export interface UserSummary {
  id: string
  name: string | null
  email: string
  image: string | null
}

export interface Project {
  id: string
  key: string
  name: string
  description: string | null
  status: ProjectStatus
  gitRepoUrl: string | null
  websiteUrl: string | null
  roadmap: string | null
  entityGraph: string | null
  readmeMd: string | null
  apiSpec: string | null
  ownerId: string
  owner: UserSummary
  createdAt: string
  updatedAt: string
  members?: ProjectMember[]
  _count?: {
    tickets: number
    services: number
  }
}

export interface ProjectKnowledgeVersion {
  id: string
  section: 'roadmap' | 'entityGraph' | 'readmeMd' | 'apiSpec'
  content: string
  mode: 'replace' | 'append'
  source: string | null
  createdAt: string
  authorId: string | null
  author: UserSummary | null
}

export interface TicketLabel {
  label: Label
}

export interface Ticket {
  id: string
  title: string
  description: string | null
  status: TicketStatus
  priority: TicketPriority
  projectId: string
  authorId: string
  author: UserSummary
  assigneeId: string | null
  assignee: UserSummary | null
  serviceId: string | null
  service?: Service | null
  parentTicketId: string | null
  createdAt: string
  updatedAt: string
  labels?: TicketLabel[]
  attachments?: Attachment[]
  _count?: {
    subTickets: number
    comments: number
  }
}

/** Full ticket detail as returned by GET /tickets/:id */
export interface TicketDetail extends Ticket {
  comments: Comment[]
  subTickets: Ticket[]
  labels: TicketLabel[]
}

export interface Comment {
  id: string
  content: string
  ticketId: string
  authorId: string
  author: UserSummary
  createdAt: string
  updatedAt: string
}

export interface Label {
  id: string
  name: string
  color: string
  projectId: string
  createdAt: string
}

export interface ProjectMember {
  id: string
  role: 'ADMIN' | 'MEMBER'
  projectId: string
  userId: string
  user: UserSummary
  createdAt: string
}

export interface Attachment {
  id: string
  filename: string
  mimeType: string
  size: number
  data: string
  ticketId: string
  uploadedById: string
  uploadedBy: UserSummary
  createdAt: string
}

export interface Service {
  id: string
  name: string
  slug: string
  description: string | null
  apiSpec: string | null
  baseUrl: string | null
  healthUrl: string | null
  status: ServiceStatus
  projectId: string
  createdAt: string
  updatedAt: string
}

export interface ApiController {
  id: string
  name: string
  basePath: string
  serviceId: string
  createdAt: string
  updatedAt: string
  endpoints?: ApiEndpoint[]
}

export interface ApiEndpoint {
  id: string
  method: string
  path: string
  handler: string
  description: string | null
  controllerId: string
  createdAt: string
  updatedAt: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
