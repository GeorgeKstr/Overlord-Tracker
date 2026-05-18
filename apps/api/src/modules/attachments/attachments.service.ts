import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

const uploadedBySelect = { id: true, name: true, email: true, image: true }

@Injectable()
export class AttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    ticketId: string,
    filename: string,
    mimeType: string,
    data: string, // base64
    uploadedById: string,
  ) {
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException(`Unsupported file type: ${mimeType}`)
    }

    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`)

    // Estimate decoded byte size
    const size = Math.floor((data.length * 3) / 4)
    if (size > MAX_SIZE_BYTES) {
      throw new BadRequestException('File exceeds 5 MB limit')
    }

    return this.prisma.attachment.create({
      data: { ticketId, filename, mimeType, data, size, uploadedById },
      include: { uploadedBy: { select: uploadedBySelect } },
    })
  }

  findByTicket(ticketId: string) {
    return this.prisma.attachment.findMany({
      where: { ticketId },
      include: { uploadedBy: { select: uploadedBySelect } },
      orderBy: { createdAt: 'asc' },
    })
  }

  async findOne(id: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: { uploadedBy: { select: uploadedBySelect } },
    })
    if (!attachment) throw new NotFoundException(`Attachment ${id} not found`)
    return attachment
  }

  async remove(id: string, userId: string) {
    const attachment = await this.findOne(id)
    if (attachment.uploadedById !== userId) {
      throw new ForbiddenException('You can only delete your own attachments')
    }
    return this.prisma.attachment.delete({ where: { id } })
  }
}
