import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { createHash, randomBytes } from 'crypto'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private isConfiguredAdminEmail(email?: string | null) {
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()
    return !!(adminEmail && email && email.toLowerCase() === adminEmail)
  }

  private async assertAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    })
    if (!user) {
      throw new ForbiddenException('Admin access required')
    }
    if (user.role !== 'ADMIN' && !this.isConfiguredAdminEmail(user.email)) {
      throw new ForbiddenException('Admin access required')
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }

  private readonly userSelect = { id: true, name: true, email: true, image: true, role: true, status: true, createdAt: true } as const

  private withProtected<T extends { email: string }>(user: T): T & { isProtected: boolean } {
    return { ...user, isProtected: this.isConfiguredAdminEmail(user.email) }
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.userSelect,
    })
    if (!user) throw new NotFoundException(`User ${id} not found`)
    if (this.isConfiguredAdminEmail(user.email) && (user.role !== 'ADMIN' || user.status !== 'APPROVED')) {
      // Self-heal the canonical admin account if role/status drifted.
      const healed = await this.prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN', status: 'APPROVED' },
        select: this.userSelect,
      })
      return this.withProtected(healed)
    }
    return this.withProtected(user)
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      where: { status: 'APPROVED' },
      select: this.userSelect,
      orderBy: { createdAt: 'asc' },
    })
    return users.map(u => this.withProtected(u))
  }

  async findPending(requesterId: string) {
    await this.assertAdmin(requesterId)
    const users = await this.prisma.user.findMany({
      where: { status: 'PENDING' },
      select: this.userSelect,
      orderBy: { createdAt: 'asc' },
    })
    return users.map(u => this.withProtected(u))
  }

  async findRejected(requesterId: string) {
    await this.assertAdmin(requesterId)
    const users = await this.prisma.user.findMany({
      where: { status: 'REJECTED' },
      select: this.userSelect,
      orderBy: { createdAt: 'asc' },
    })
    return users.map(u => this.withProtected(u))
  }

  async updateRole(requesterId: string, userId: string, role: 'USER' | 'MODERATOR' | 'ADMIN') {
    await this.assertAdmin(requesterId)
    const target = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!target) throw new NotFoundException(`User ${userId} not found`)

    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()
    if (adminEmail && target.email.toLowerCase() === adminEmail) {
      throw new ForbiddenException('The original admin account cannot be modified')
    }

    return this.withProtected(await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: this.userSelect,
    }))
  }

  async approveUser(requesterId: string, userId: string) {
    await this.assertAdmin(requesterId)
    const target = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!target) throw new NotFoundException(`User ${userId} not found`)
    return this.prisma.user.update({
      where: { id: userId },
      data: { status: 'APPROVED' },
      select: this.userSelect,
    })
  }

  async rejectUser(requesterId: string, userId: string) {
    await this.assertAdmin(requesterId)
    const target = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!target) throw new NotFoundException(`User ${userId} not found`)
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()
    if (adminEmail && target.email.toLowerCase() === adminEmail) {
      throw new ForbiddenException('The original admin account cannot be modified')
    }
    // Set REJECTED instead of deleting — the user may already have project data
    await this.prisma.user.update({ where: { id: userId }, data: { status: 'REJECTED' } })
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
