import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateTicketDto } from './dto/create-ticket.dto'
import { UpdateTicketDto } from './dto/update-ticket.dto'

const userSelect = { id: true, name: true, email: true, image: true }

const ticketInclude = {
  author: { select: userSelect },
  assignee: { select: userSelect },
  project: { select: { id: true, name: true, key: true } },
  service: { select: { id: true, name: true, slug: true, description: true, status: true, projectId: true } },
  _count: { select: { subTickets: true, comments: true } },
  labels: { include: { label: true } },
  attachments: {
    include: { uploadedBy: { select: userSelect } },
    orderBy: { createdAt: 'asc' as const },
  },
} as const

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeTake(limit?: number) {
    return limit && Number.isFinite(limit)
      ? Math.max(1, Math.min(200, Math.trunc(limit)))
      : undefined
  }

  private normalizePage(page?: number) {
    if (!page || !Number.isFinite(page)) return 1
    return Math.max(1, Math.trunc(page))
  }

  private normalizePageSize(pageSize?: number) {
    if (!pageSize || !Number.isFinite(pageSize)) return 20
    return Math.max(1, Math.min(100, Math.trunc(pageSize)))
  }

  private buildTicketFilters(
    filters?: {
      status?: string
      priority?: string
      assigneeId?: string
      serviceId?: string
      effort?: string
      tested?: string
      q?: string
      includeSubtickets?: boolean
      parentTicketId?: string | null
    },
  ) {
    const parentFilter =
      filters?.parentTicketId === null
        ? { parentTicketId: null }
        : filters?.parentTicketId
          ? { parentTicketId: filters.parentTicketId }
          : (!filters?.includeSubtickets ? { parentTicketId: null } : {})

    return {
      ...parentFilter,
      ...(filters?.status ? { status: filters.status as any } : {}),
      ...(filters?.priority ? { priority: filters.priority as any } : {}),
      ...(filters?.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters?.serviceId
        ? (filters.serviceId === '__none__' ? { serviceId: null } : { serviceId: filters.serviceId })
        : {}),
      ...(filters?.effort
        ? (filters.effort === '__none__' ? { effort: null } : { effort: filters.effort as any })
        : {}),
      ...(filters?.tested !== undefined
        ? (String(filters.tested).toLowerCase() === 'true'
            ? { tested: true }
            : String(filters.tested).toLowerCase() === 'false'
              ? { tested: false }
              : {})
        : {}),
      ...(filters?.q
        ? {
            OR: [
              { title: { contains: filters.q } },
              { description: { contains: filters.q } },
            ],
          }
        : {}),
    }
  }

  private async assertProjectAccess(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ownerId: true,
        members: { where: { userId }, select: { id: true } },
      },
    })

    if (!project) throw new NotFoundException(`Project ${projectId} not found`)
    const allowed = project.ownerId === userId || project.members.length > 0
    if (!allowed) throw new ForbiddenException('You do not have access to this project')
  }

  async create(dto: CreateTicketDto, authorId: string) {
    await this.assertProjectAccess(dto.projectId, authorId)

    if (dto.serviceId) {
      const service = await this.prisma.service.findUnique({
        where: { id: dto.serviceId },
        select: { id: true, projectId: true },
      })
      if (!service || service.projectId !== dto.projectId) {
        throw new BadRequestException('serviceId must belong to the same project')
      }
    }

    // Verify parent ticket if provided
    if (dto.parentTicketId) {
      const parent = await this.prisma.ticket.findUnique({
        where: { id: dto.parentTicketId },
      })
      if (!parent) {
        throw new NotFoundException(`Parent ticket ${dto.parentTicketId} not found`)
      }
      if (parent.parentTicketId) {
        throw new BadRequestException('Cannot nest subtickets more than one level deep')
      }
    }

    return this.prisma.ticket.create({
      data: { ...dto, authorId },
      include: ticketInclude,
    })
  }

  findByProject(
    projectId: string,
    userId: string,
    filters?: {
      status?: string
      priority?: string
      assigneeId?: string
      serviceId?: string
      effort?: string
      tested?: string
      q?: string
      limit?: number
      includeSubtickets?: boolean
      parentTicketId?: string | null
    },
  ) {
    if (!projectId) {
      throw new BadRequestException('projectId is required')
    }

    const take = this.normalizeTake(filters?.limit)

    return this.assertProjectAccess(projectId, userId).then(() => this.prisma.ticket.findMany({
      where: {
        projectId,
        ...this.buildTicketFilters(filters),
      },
      include: ticketInclude,
      orderBy: { createdAt: 'desc' },
      ...(take ? { take } : {}),
    }))
  }

  findAllAccessible(
    userId: string,
    filters?: {
      status?: string
      priority?: string
      assigneeId?: string
      serviceId?: string
      effort?: string
      tested?: string
      q?: string
      limit?: number
      includeSubtickets?: boolean
      parentTicketId?: string | null
    },
  ) {
    const take = this.normalizeTake(filters?.limit)

    return this.prisma.ticket.findMany({
      where: {
        project: {
          OR: [
            { ownerId: userId },
            { members: { some: { userId } } },
          ],
        },
        ...this.buildTicketFilters(filters),
      },
      include: ticketInclude,
      orderBy: { createdAt: 'desc' },
      ...(take ? { take } : {}),
    })
  }

  async findByProjectPaginated(
    projectId: string,
    userId: string,
    filters?: {
      status?: string
      priority?: string
      assigneeId?: string
      serviceId?: string
      effort?: string
      tested?: string
      q?: string
      page?: number
      pageSize?: number
      includeSubtickets?: boolean
      parentTicketId?: string | null
    },
  ) {
    if (!projectId) {
      throw new BadRequestException('projectId is required')
    }

    await this.assertProjectAccess(projectId, userId)
    const page = this.normalizePage(filters?.page)
    const pageSize = this.normalizePageSize(filters?.pageSize)
    const where = {
      projectId,
      ...this.buildTicketFilters(filters),
    }

    const [total, items] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: ticketInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  async findAllAccessiblePaginated(
    userId: string,
    filters?: {
      status?: string
      priority?: string
      assigneeId?: string
      serviceId?: string
      effort?: string
      tested?: string
      q?: string
      page?: number
      pageSize?: number
      projectId?: string
      includeSubtickets?: boolean
      parentTicketId?: string | null
    },
  ) {
    const page = this.normalizePage(filters?.page)
    const pageSize = this.normalizePageSize(filters?.pageSize)
    const where = {
      project: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
      ...(filters?.projectId ? { projectId: filters.projectId } : {}),
      ...this.buildTicketFilters(filters),
    }

    const [total, items] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: ticketInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  async findSubtickets(parentTicketId: string, userId: string) {
    const parent = await this.prisma.ticket.findUnique({
      where: { id: parentTicketId },
      select: { projectId: true },
    })
    if (!parent) throw new NotFoundException(`Ticket ${parentTicketId} not found`)
    await this.assertProjectAccess(parent.projectId, userId)

    return this.prisma.ticket.findMany({
      where: { parentTicketId },
      include: ticketInclude,
      orderBy: { createdAt: 'asc' },
    })
  }

  async findOne(id: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        ...ticketInclude,
        comments: {
          include: { author: { select: userSelect } },
          orderBy: { createdAt: 'asc' },
        },
        subTickets: {
          include: ticketInclude,
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`)
    await this.assertProjectAccess(ticket.projectId, userId)
    return ticket
  }

  async update(id: string, dto: UpdateTicketDto, userId: string) {
    const existing = await this.findOne(id, userId)

    if (dto.serviceId) {
      const service = await this.prisma.service.findUnique({
        where: { id: dto.serviceId },
        select: { id: true, projectId: true },
      })
      if (!service || service.projectId !== existing.projectId) {
        throw new BadRequestException('serviceId must belong to the same project')
      }
    }

    return this.prisma.ticket.update({
      where: { id },
      data: dto,
      include: ticketInclude,
    })
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId)
    return this.prisma.ticket.delete({ where: { id } })
  }
}
