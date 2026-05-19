import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { EmailService } from '../email/email.service'
import { ConfigService } from '@nestjs/config'
import { CreateProjectDto } from './dto/create-project.dto'
import { UpdateProjectDto } from './dto/update-project.dto'

const userSelect = { id: true, name: true, email: true, image: true }
const KNOWLEDGE_SECTIONS = ['roadmap', 'entityGraph', 'readmeMd', 'apiSpec'] as const
type KnowledgeSection = (typeof KNOWLEDGE_SECTIONS)[number]

const projectInclude = {
  owner: { select: userSelect },
  members: { include: { user: { select: userSelect } }, orderBy: { createdAt: 'asc' as const } },
  _count: { select: { tickets: true, services: true } },
} as const

const ticketInclude = {
  author: { select: userSelect },
  assignee: { select: userSelect },
  _count: { select: { subTickets: true, comments: true } },
  labels: { include: { label: true } },
  attachments: {
    include: { uploadedBy: { select: userSelect } },
    orderBy: { createdAt: 'asc' as const },
  },
} as const

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateProjectDto, ownerId: string) {
    const creator = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { role: true },
    })
    if (!creator || (creator.role !== 'MODERATOR' && creator.role !== 'ADMIN')) {
      throw new ForbiddenException('Only moderators can create projects')
    }

    const existing = await this.prisma.project.findUnique({ where: { key: dto.key } })
    if (existing) throw new ConflictException(`A project with key '${dto.key}' already exists`)

    return this.prisma.project.create({
      data: { ...dto, ownerId },
      include: projectInclude,
    })
  }

  /** Returns projects accessible to the given user (owned or member).
   * ADMIN users see every project. */
  findAll(userId: string, userRole?: string) {
    if (userRole === 'ADMIN') {
      return this.prisma.project.findMany({
        include: projectInclude,
        orderBy: { createdAt: 'desc' },
      })
    }
    return this.prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
      include: projectInclude,
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string, userId: string) {
    const [project, requestingUser] = await Promise.all([
      this.prisma.project.findUnique({ where: { id }, include: projectInclude }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    ])
    if (!project) throw new NotFoundException(`Project ${id} not found`)
    if (requestingUser?.role === 'ADMIN') return project
    const hasAccess =
      project.ownerId === userId ||
      project.members.some((m) => m.userId === userId)
    if (!hasAccess) throw new ForbiddenException('You do not have access to this project')
    return project
  }

  async findByKey(key: string, userId: string) {
    const [project, requestingUser] = await Promise.all([
      this.prisma.project.findUnique({ where: { key }, include: projectInclude }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    ])
    if (!project) throw new NotFoundException(`Project with key '${key}' not found`)
    if (requestingUser?.role === 'ADMIN') return project
    const hasAccess = project.ownerId === userId || project.members.some((m) => m.userId === userId)
    if (!hasAccess) throw new ForbiddenException('You do not have access to this project')
    return project
  }

  async update(id: string, dto: UpdateProjectDto, userId: string) {
    await this.findOne(id, userId)
    return this.prisma.project.update({ where: { id }, data: dto, include: projectInclude })
  }

  async remove(id: string, userId: string) {
    // findOne already handles access: ADMIN can access any project,
    // others must be owner or collaborator.  All three groups may delete.
    await this.findOne(id, userId)
    return this.prisma.project.delete({ where: { id } })
  }

  // ── Members ──────────────────────────────────────────────────────────────

  async getMembers(projectId: string, userId: string) {
    await this.findOne(projectId, userId)
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: userSelect } },
      orderBy: { createdAt: 'asc' },
    })
  }

  async addMember(projectId: string, email: string, role: string, requesterId: string) {
    const project = await this.findOne(projectId, requesterId)

    // Only project owner, admins, or moderators can add members
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    })
    const isOwner = project.ownerId === requesterId
    const isPrivileged = requester?.role === 'ADMIN' || requester?.role === 'MODERATOR'
    if (!isOwner && !isPrivileged) {
      throw new ForbiddenException('Only the project owner, admins, or moderators can add members')
    }

    const user = await this.prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: null,
        role: 'USER',
        status: 'APPROVED',
      },
    })
    if (user.id === project.ownerId) throw new BadRequestException('Owner is already a member')

    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    })
    if (existing) throw new ConflictException(`User '${email}' is already a member`)

    const member = await this.prisma.projectMember.create({
      data: { projectId, userId: user.id, role },
      include: { user: { select: userSelect } },
    })

    const requesterFull = await this.prisma.user.findUnique({ where: { id: requesterId } })
    const appUrl = this.config.get<string>('DASHBOARD_URL') ?? 'http://localhost:3000'
    this.email
      .sendProjectInvitation({
        to: email,
        inviterName: requesterFull?.name ?? requesterFull?.email ?? 'A teammate',
        projectName: project.name,
        projectId: project.id,
        appUrl,
      })
      .catch(() => { /* fire-and-forget */ })

    return member
  }

  async removeMember(projectId: string, memberId: string, requesterId: string) {
    const project = await this.findOne(projectId, requesterId)
    if (project.ownerId !== requesterId && requesterId !== memberId) {
      throw new ForbiddenException('Only the owner can remove other members')
    }
    const member = await this.prisma.projectMember.findFirst({
      where: { projectId, userId: memberId },
    })
    if (!member) throw new NotFoundException('Member not found')
    return this.prisma.projectMember.delete({ where: { id: member.id } })
  }

  async getAgentUrls(projectId: string, userId: string) {
    const project = await this.findOne(projectId, userId)
    return {
      project: {
        id: project.id,
        key: project.key,
        name: project.name,
        gitRepoUrl: project.gitRepoUrl,
        websiteUrl: project.websiteUrl,
      },
      read: {
        projects: '/projects',
        project: `/projects/${projectId}`,
        projectContext: `/projects/${projectId}/context`,
        projectMembers: `/projects/${projectId}/members`,
        projectKnowledge: `/projects/${projectId}`,
        projectKnowledgeHistory: `/projects/${projectId}/knowledge/history`,
        tickets: `/tickets?projectId=${projectId}`,
      },
      write: {
        createTicket: '/tickets',
        updateTicket: '/tickets/{ticketId}',
        ingestControllers: '/ingestion/controllers',
        updateProjectKnowledge: `/projects/${projectId}/knowledge`,
        ingestRoadmap: `/projects/${projectId}/knowledge/roadmap/ingest`,
        ingestEntityGraph: `/projects/${projectId}/knowledge/entityGraph/ingest`,
        ingestReadme: `/projects/${projectId}/knowledge/readmeMd/ingest`,
        ingestApiSpec: `/projects/${projectId}/knowledge/apiSpec/ingest`,
      },
      notes: [
        'Use Authorization: Bearer <JWT_OR_PERSONAL_TOKEN>',
        'PATCH /tickets/{ticketId} accepts status, priority, assigneeId, description',
        'POST /tickets body must include projectId and title',
        'Knowledge ingestion is API-first via /projects/{id}/knowledge/{section}/ingest',
      ],
    }
  }

  async getAgentIndex(userId: string, userRole?: string) {
    const projects = await this.findAll(userId, userRole)
    return {
      projects: projects.map((project) => ({
        id: project.id,
        key: project.key,
        name: project.name,
        status: project.status,
        urls: {
          project: `/projects/${project.id}`,
          context: `/projects/${project.id}/context`,
          tickets: `/tickets?projectId=${project.id}`,
          members: `/projects/${project.id}/members`,
          knowledgeHistory: `/projects/${project.id}/knowledge/history`,
          ingest: {
            roadmap: `/projects/${project.id}/knowledge/roadmap/ingest`,
            entityGraph: `/projects/${project.id}/knowledge/entityGraph/ingest`,
            readmeMd: `/projects/${project.id}/knowledge/readmeMd/ingest`,
            apiSpec: `/projects/${project.id}/knowledge/apiSpec/ingest`,
          },
        },
      })),
      filters: {
        tickets: ['status', 'priority', 'assigneeId', 'q', 'limit'],
      },
      notes: [
        'All routes require Authorization: Bearer <JWT_OR_PERSONAL_TOKEN>',
        'Use /projects/{id}/context to fetch project + knowledge + filtered tickets in one call',
      ],
    }
  }

  async getProjectContext(
    projectId: string,
    userId: string,
    filters?: { status?: string; priority?: string; assigneeId?: string; q?: string; limit?: number },
  ) {
    const project = await this.findOne(projectId, userId)
    const take = filters?.limit && Number.isFinite(filters.limit)
      ? Math.max(1, Math.min(200, Math.trunc(filters.limit)))
      : undefined

    const tickets = await this.prisma.ticket.findMany({
      where: {
        projectId,
        parentTicketId: null,
        ...(filters?.status ? { status: filters.status as any } : {}),
        ...(filters?.priority ? { priority: filters.priority as any } : {}),
        ...(filters?.assigneeId ? { assigneeId: filters.assigneeId } : {}),
        ...(filters?.q
          ? {
              OR: [
                { title: { contains: filters.q } },
                { description: { contains: filters.q } },
              ],
            }
          : {}),
      },
      include: ticketInclude,
      orderBy: { createdAt: 'desc' },
      ...(take ? { take } : {}),
    })

    const recentKnowledgeHistory = await this.prisma.projectKnowledgeVersion.findMany({
      where: { projectId },
      include: { author: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return {
      project,
      knowledge: {
        roadmap: project.roadmap,
        entityGraph: project.entityGraph,
        readmeMd: project.readmeMd,
        apiSpec: project.apiSpec,
      },
      tickets,
      history: recentKnowledgeHistory,
      appliedFilters: {
        status: filters?.status ?? null,
        priority: filters?.priority ?? null,
        assigneeId: filters?.assigneeId ?? null,
        q: filters?.q ?? null,
        limit: take ?? null,
      },
      links: {
        project: `/projects/${projectId}`,
        tickets: `/tickets?projectId=${projectId}`,
        history: `/projects/${projectId}/knowledge/history`,
      },
    }
  }

  private async recordKnowledgeVersion(
    projectId: string,
    section: KnowledgeSection,
    content: string,
    mode: 'replace' | 'append',
    authorId: string,
    source?: string,
  ) {
    const normalized = content.trim()
    if (!normalized) return null

    return this.prisma.projectKnowledgeVersion.create({
      data: {
        projectId,
        section,
        content: normalized,
        mode,
        source,
        authorId,
      },
      include: {
        author: { select: userSelect },
      },
    })
  }

  async getKnowledgeHistory(projectId: string, userId: string, section?: string) {
    await this.findOne(projectId, userId)
    if (section && !KNOWLEDGE_SECTIONS.includes(section as KnowledgeSection)) {
      throw new BadRequestException(`Unknown knowledge section '${section}'`)
    }

    return this.prisma.projectKnowledgeVersion.findMany({
      where: {
        projectId,
        ...(section ? { section } : {}),
      },
      include: {
        author: { select: userSelect },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async updateKnowledge(
    projectId: string,
    patch: Partial<Record<KnowledgeSection, string | null | undefined>>,
    userId: string,
  ) {
    await this.findOne(projectId, userId)
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        roadmap: patch.roadmap,
        entityGraph: patch.entityGraph,
        readmeMd: patch.readmeMd,
        apiSpec: patch.apiSpec,
      },
      include: projectInclude,
    })

    const entries = Object.entries(patch) as Array<[KnowledgeSection, string | null | undefined]>
    await Promise.all(
      entries
        .filter(([, value]) => typeof value === 'string')
        .map(([section, value]) =>
          this.recordKnowledgeVersion(projectId, section, value ?? '', 'replace', userId, 'dashboard-edit'),
        ),
    )

    return updated
  }

  async ingestKnowledge(
    projectId: string,
    section: string,
    content: string,
    mode: 'replace' | 'append',
    userId: string,
    source?: string,
  ) {
    if (!KNOWLEDGE_SECTIONS.includes(section as KnowledgeSection)) {
      throw new BadRequestException(`Unknown knowledge section '${section}'`)
    }

    const validSection = section as KnowledgeSection
    const project = await this.findOne(projectId, userId)
    const existing = (project[validSection] ?? '').trim()
    const incoming = (content ?? '').trim()
    const merged =
      mode === 'append' && existing
        ? `${existing}\n\n${incoming}`
        : incoming

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { [validSection]: merged },
      include: projectInclude,
    })

    await this.recordKnowledgeVersion(projectId, validSection, merged, mode, userId, source)

    return {
      section: validSection,
      mode,
      source: source ?? 'unspecified',
      contentLength: merged.length,
      project: updated,
    }
  }
}
