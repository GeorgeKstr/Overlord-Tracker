import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateCommentDto } from './dto/create-comment.dto'

const authorSelect = { select: { id: true, name: true, email: true, image: true } }

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertTicketAccess(ticketId: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        project: {
          select: {
            ownerId: true,
            members: { where: { userId }, select: { id: true } },
          },
        },
      },
    })

    if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`)

    const allowed = ticket.project.ownerId === userId || ticket.project.members.length > 0
    if (!allowed) throw new ForbiddenException('You do not have access to this ticket')
  }

  async create(dto: CreateCommentDto, authorId: string) {
    await this.assertTicketAccess(dto.ticketId, authorId)

    return this.prisma.comment.create({
      data: { content: dto.content, ticketId: dto.ticketId, authorId },
      include: { author: authorSelect },
    })
  }

  async findByTicket(ticketId: string, userId: string) {
    await this.assertTicketAccess(ticketId, userId)

    return this.prisma.comment.findMany({
      where: { ticketId },
      include: { author: authorSelect },
      orderBy: { createdAt: 'asc' },
    })
  }

  async update(id: string, content: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: { ticket: { select: { id: true } } },
    })
    if (!comment) throw new NotFoundException(`Comment ${id} not found`)
    await this.assertTicketAccess(comment.ticket.id, userId)
    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own comments')
    }
    return this.prisma.comment.update({
      where: { id },
      data: { content },
      include: { author: authorSelect },
    })
  }

  async remove(id: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: { ticket: { select: { id: true } } },
    })
    if (!comment) throw new NotFoundException(`Comment ${id} not found`)
    await this.assertTicketAccess(comment.ticket.id, userId)
    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments')
    }
    return this.prisma.comment.delete({ where: { id } })
  }
}
