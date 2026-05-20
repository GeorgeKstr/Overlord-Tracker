import { Injectable, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (user?.role !== 'ADMIN') throw new ForbiddenException('Admin only')
  }

  /** Wipe all data except ADMIN users and their accounts */
  async wipeDatabase(requestingUserId: string) {
    await this.assertAdmin(requestingUserId)

    const adminIds = (
      await this.prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      })
    ).map((u) => u.id)

    // Delete in dependency order
    await this.prisma.ticketLabel.deleteMany({})
    await this.prisma.attachment.deleteMany({})
    await this.prisma.comment.deleteMany({})
    await this.prisma.ticket.deleteMany({})
    await this.prisma.projectKnowledgeVersion.deleteMany({})
    await this.prisma.projectMember.deleteMany({})
    await this.prisma.label.deleteMany({})
    await this.prisma.service.deleteMany({})
    await this.prisma.project.deleteMany({})
    await this.prisma.personalAccessToken.deleteMany({
      where: { userId: { notIn: adminIds } },
    })
    await this.prisma.account.deleteMany({
      where: { userId: { notIn: adminIds } },
    })
    await this.prisma.verificationToken.deleteMany({})
    await this.prisma.user.deleteMany({
      where: { id: { notIn: adminIds } },
    })

    return { ok: true, preserved: adminIds.length, message: `Wiped all data. ${adminIds.length} admin account(s) preserved.` }
  }

  /** Export entire database as a structured JSON snapshot */
  async exportDatabase(requestingUserId: string) {
    await this.assertAdmin(requestingUserId)

    const [
      users,
      accounts,
      projects,
      projectMembers,
      projectKnowledgeVersions,
      tickets,
      ticketLabels,
      comments,
      labels,
      services,
      attachments,
      personalAccessTokens,
    ] = await Promise.all([
      this.prisma.user.findMany(),
      this.prisma.account.findMany(),
      this.prisma.project.findMany(),
      this.prisma.projectMember.findMany(),
      this.prisma.projectKnowledgeVersion.findMany(),
      this.prisma.ticket.findMany(),
      this.prisma.ticketLabel.findMany(),
      this.prisma.comment.findMany(),
      this.prisma.label.findMany(),
      this.prisma.service.findMany(),
      this.prisma.attachment.findMany(),
      this.prisma.personalAccessToken.findMany(),
    ])

    return {
      _meta: {
        version: 1,
        exportedAt: new Date().toISOString(),
        counts: {
          users: users.length,
          projects: projects.length,
          tickets: tickets.length,
          services: services.length,
          comments: comments.length,
          labels: labels.length,
        },
      },
      users,
      accounts,
      projects,
      projectMembers,
      projectKnowledgeVersions,
      tickets,
      ticketLabels,
      comments,
      labels,
      services,
      attachments,
      personalAccessTokens,
    }
  }

  /** Import a database snapshot — wipes first, then restores */
  async importDatabase(
    requestingUserId: string,
    snapshot: ReturnType<typeof this.exportDatabase> extends Promise<infer T> ? T : never,
  ) {
    await this.assertAdmin(requestingUserId)

    const data = snapshot as {
      users?: unknown[]
      accounts?: unknown[]
      projects?: unknown[]
      projectMembers?: unknown[]
      projectKnowledgeVersions?: unknown[]
      tickets?: unknown[]
      ticketLabels?: unknown[]
      comments?: unknown[]
      labels?: unknown[]
      services?: unknown[]
      attachments?: unknown[]
      personalAccessTokens?: unknown[]
    }

    if (!data?.users) {
      throw new Error('Invalid snapshot: missing users array')
    }

    // Wipe first (preserves nothing since we're restoring full snapshot)
    await this.prisma.ticketLabel.deleteMany({})
    await this.prisma.attachment.deleteMany({})
    await this.prisma.comment.deleteMany({})
    await this.prisma.ticket.deleteMany({})
    await this.prisma.projectKnowledgeVersion.deleteMany({})
    await this.prisma.projectMember.deleteMany({})
    await this.prisma.label.deleteMany({})
    await this.prisma.service.deleteMany({})
    await this.prisma.project.deleteMany({})
    await this.prisma.personalAccessToken.deleteMany({})
    await this.prisma.account.deleteMany({})
    await this.prisma.verificationToken.deleteMany({})
    await this.prisma.user.deleteMany({})

    // Restore in dependency order using createMany
    if (data.users?.length) {
      await this.prisma.user.createMany({ data: data.users as never[] })
    }
    if (data.accounts?.length) {
      await this.prisma.account.createMany({ data: data.accounts as never[] })
    }
    if (data.projects?.length) {
      await this.prisma.project.createMany({ data: data.projects as never[] })
    }
    if (data.projectMembers?.length) {
      await this.prisma.projectMember.createMany({ data: data.projectMembers as never[] })
    }
    if (data.projectKnowledgeVersions?.length) {
      await this.prisma.projectKnowledgeVersion.createMany({ data: data.projectKnowledgeVersions as never[] })
    }
    if (data.labels?.length) {
      await this.prisma.label.createMany({ data: data.labels as never[] })
    }
    if (data.services?.length) {
      await this.prisma.service.createMany({ data: data.services as never[] })
    }
    if (data.tickets?.length) {
      await this.prisma.ticket.createMany({ data: data.tickets as never[] })
    }
    if (data.ticketLabels?.length) {
      await this.prisma.ticketLabel.createMany({ data: data.ticketLabels as never[] })
    }
    if (data.comments?.length) {
      await this.prisma.comment.createMany({ data: data.comments as never[] })
    }
    if (data.attachments?.length) {
      await this.prisma.attachment.createMany({ data: data.attachments as never[] })
    }
    if (data.personalAccessTokens?.length) {
      await this.prisma.personalAccessToken.createMany({ data: data.personalAccessTokens as never[] })
    }

    return {
      ok: true,
      message: 'Database imported successfully.',
      counts: {
        users: data.users?.length ?? 0,
        projects: data.projects?.length ?? 0,
        tickets: data.tickets?.length ?? 0,
      },
    }
  }
}
