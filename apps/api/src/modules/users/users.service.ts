import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { createHash, randomBytes } from 'crypto'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, image: true, createdAt: true },
    })
    if (!user) throw new NotFoundException(`User ${id} not found`)
    return user
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: { id: true, name: true, email: true, image: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  async listPersonalTokens(userId: string) {
    return this.prisma.personalAccessToken.findMany({
      where: { userId, revokedAt: null },
      select: {
        id: true,
        name: true,
        last4: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createPersonalToken(userId: string, name: string, expiresInDays?: number) {
    const raw = randomBytes(24).toString('hex')
    const token = `ovl_pat_${raw}`
    const tokenHash = this.hashToken(token)
    const last4 = raw.slice(-4)
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null

    const created = await this.prisma.personalAccessToken.create({
      data: { userId, name, tokenHash, last4, expiresAt },
      select: {
        id: true,
        name: true,
        last4: true,
        createdAt: true,
        expiresAt: true,
      },
    })

    return {
      ...created,
      token,
      note: 'Store this token now. It is only shown once.',
    }
  }

  async revokePersonalToken(userId: string, tokenId: string) {
    const token = await this.prisma.personalAccessToken.findUnique({ where: { id: tokenId } })
    if (!token) throw new NotFoundException('Token not found')
    if (token.userId !== userId) throw new ForbiddenException('Not your token')
    await this.prisma.personalAccessToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    })
  }
}
