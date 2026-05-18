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
    filters?: { status?: string; priority?: string; assigneeId?: string; q?: string; limit?: number },
  ) {
    if (!projectId) {
      throw new BadRequestException('projectId is required')
    }

    const take = this.normalizeTake(filters?.limit)

    return this.assertProjectAccess(projectId, userId).then(() => this.prisma.ticket.findMany({
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
    }))
  }

  findAllAccessible(
    userId: string,
    filters?: { status?: string; priority?: string; assigneeId?: string; q?: string; limit?: number },
  ) {
    const take = this.normalizeTake(filters?.limit)

    return this.prisma.ticket.findMany({
      where: {
        parentTicketId: null,
        project: {
          OR: [
            { ownerId: userId },
            { members: { some: { userId } } },
          ],
        },
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
