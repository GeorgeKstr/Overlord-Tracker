import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateServiceDto } from './dto/create-service.dto'
import { UpdateServiceDto } from './dto/update-service.dto'

const serviceInclude = {
  project: { select: { id: true, key: true, name: true } },
  _count: { select: { controllers: true } },
} as const

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePage(page?: number) {
    if (!page || !Number.isFinite(page)) return 1
    return Math.max(1, Math.trunc(page))
  }

  private normalizePageSize(pageSize?: number) {
    if (!pageSize || !Number.isFinite(pageSize)) return 20
    return Math.max(1, Math.min(100, Math.trunc(pageSize)))
  }

  private buildServiceWhere(userId: string, projectId?: string, q?: string) {
    return {
      project: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
      ...(projectId ? { projectId } : {}),
      ...(q?.trim()
        ? {
            OR: [
              { name: { contains: q } },
              { slug: { contains: q } },
              { description: { contains: q } },
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

  async create(dto: CreateServiceDto, userId: string) {
    await this.assertProjectAccess(dto.projectId, userId)

    const existing = await this.prisma.service.findUnique({
      where: { projectId_slug: { projectId: dto.projectId, slug: dto.slug } },
    })
    if (existing) {
      throw new ConflictException(
        `Service with slug '${dto.slug}' already exists in this project`,
      )
    }

    return this.prisma.service.create({
      data: dto,
      include: serviceInclude,
    })
  }

  findAll(userId: string, q?: string) {
    return this.prisma.service.findMany({
      where: this.buildServiceWhere(userId, undefined, q),
      include: serviceInclude,
      orderBy: { name: 'asc' },
    })
  }

  findByProject(projectId: string, userId: string, q?: string) {
    return this.assertProjectAccess(projectId, userId).then(() => this.prisma.service.findMany({
      where: this.buildServiceWhere(userId, projectId, q),
      include: serviceInclude,
      orderBy: { name: 'asc' },
    }))
  }

  async findAllPaginated(
    userId: string,
    options?: { projectId?: string; q?: string; page?: number; pageSize?: number },
  ) {
    if (options?.projectId) {
      await this.assertProjectAccess(options.projectId, userId)
    }

    const page = this.normalizePage(options?.page)
    const pageSize = this.normalizePageSize(options?.pageSize)
    const where = this.buildServiceWhere(userId, options?.projectId, options?.q)

    const [total, items] = await Promise.all([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        include: serviceInclude,
        orderBy: { name: 'asc' },
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

  async findOne(id: string, userId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        ...serviceInclude,
        controllers: {
          include: { endpoints: true },
          orderBy: { name: 'asc' },
        },
      },
    })
    if (!service) throw new NotFoundException(`Service ${id} not found`)
    await this.assertProjectAccess(service.projectId, userId)
    return service
  }

  async update(id: string, dto: UpdateServiceDto, userId: string) {
    const service = await this.findOne(id, userId)
    if (dto.projectId && dto.projectId !== service.projectId) {
      await this.assertProjectAccess(dto.projectId, userId)
    }
    return this.prisma.service.update({
      where: { id },
      data: dto,
      include: serviceInclude,
    })
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId)
    return this.prisma.service.delete({ where: { id } })
  }
}
