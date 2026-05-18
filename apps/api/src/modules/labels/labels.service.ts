import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateLabelDto } from './dto/create-label.dto'

@Injectable()
export class LabelsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLabelDto) {
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

  findByProject(projectId: string) {
    return this.prisma.label.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    })
  }

  async remove(id: string) {
    const label = await this.prisma.label.findUnique({ where: { id } })
    if (!label) throw new NotFoundException(`Label ${id} not found`)
    return this.prisma.label.delete({ where: { id } })
  }

  async addToTicket(ticketId: string, labelId: string) {
    return this.prisma.ticketLabel.create({ data: { ticketId, labelId } })
  }

  async removeFromTicket(ticketId: string, labelId: string) {
    return this.prisma.ticketLabel.delete({
      where: { ticketId_labelId: { ticketId, labelId } },
    })
  }
}
