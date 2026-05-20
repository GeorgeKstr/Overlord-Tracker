import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateLabelDto } from './dto/create-label.dto'

@Injectable()
export class LabelsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(dto: CreateLabelDto, userId: string) {
    await this.assertProjectAccess(dto.projectId, userId)

    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    })
    if (!project) throw new NotFoundException(`Project ${dto.projectId} not found`)

    const existing = await this.prisma.label.findUnique({
      where: { projectId_name: { projectId: dto.projectId, name: dto.name } },
    })
    if (existing) throw new ConflictException(`Label '${dto.name}' already exists in this project`)

    return this.prisma.label.create({ data: dto })
  }

  async findByProject(projectId: string, userId: string) {
    await this.assertProjectAccess(projectId, userId)

    return this.prisma.label.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    })
  }

  async remove(id: string, userId: string) {
    const label = await this.prisma.label.findUnique({ where: { id } })
    if (!label) throw new NotFoundException(`Label ${id} not found`)
    await this.assertProjectAccess(label.projectId, userId)

    return this.prisma.label.delete({ where: { id } })
  }

  async addToTicket(ticketId: string, labelId: string, userId: string) {
    const [ticket, label] = await Promise.all([
      this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { projectId: true },
      }),
      this.prisma.label.findUnique({
        where: { id: labelId },
        select: { projectId: true },
      }),
    ])

    if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`)
    if (!label) throw new NotFoundException(`Label ${labelId} not found`)

    await this.assertProjectAccess(ticket.projectId, userId)

    if (ticket.projectId !== label.projectId) {
      throw new BadRequestException('Label and ticket must belong to the same project')
    }

    return this.prisma.ticketLabel.create({ data: { ticketId, labelId } })
  }

  async removeFromTicket(ticketId: string, labelId: string, userId: string) {
    const [ticket, label] = await Promise.all([
      this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { projectId: true },
      }),
      this.prisma.label.findUnique({
        where: { id: labelId },
        select: { projectId: true },
      }),
    ])

    if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`)
    if (!label) throw new NotFoundException(`Label ${labelId} not found`)

    await this.assertProjectAccess(ticket.projectId, userId)

    if (ticket.projectId !== label.projectId) {
      throw new BadRequestException('Label and ticket must belong to the same project')
    }

    return this.prisma.ticketLabel.delete({
      where: { ticketId_labelId: { ticketId, labelId } },
    })
  }
}
