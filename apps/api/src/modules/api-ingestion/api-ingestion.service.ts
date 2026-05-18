import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { IngestControllersDto } from './dto/ingest-controllers.dto'

@Injectable()
export class ApiIngestionService {
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

  async ingestControllers(dto: IngestControllersDto, userId: string) {
    // Resolve project by key
    const project = await this.prisma.project.findUnique({
      where: { key: dto.projectKey },
    })
    if (!project) {
      throw new NotFoundException(`Project with key '${dto.projectKey}' not found`)
    }
    await this.assertProjectAccess(project.id, userId)

    // Upsert service
    const service = await this.prisma.service.upsert({
      where: { projectId_slug: { projectId: project.id, slug: dto.service } },
      create: {
        projectId: project.id,
        slug: dto.service,
        name: dto.service,
      },
      update: {},
    })

    // Delete existing controllers for this service (full refresh strategy)
    await this.prisma.apiController.deleteMany({
      where: { serviceId: service.id },
    })

    // Recreate all controllers and endpoints
    for (const ctrl of dto.controllers) {
      await this.prisma.apiController.create({
        data: {
          serviceId: service.id,
          name: ctrl.name,
          basePath: ctrl.basePath,
          endpoints: {
            create: ctrl.endpoints.map((ep) => ({
              method: ep.method,
              path: ep.path,
              handler: ep.handler,
              description: ep.description,
            })),
          },
        },
      })
    }

    // Record ingestion event
    await this.prisma.apiIngestionEvent.create({
      data: {
        serviceId: service.id,
        payload: JSON.stringify(dto),
        source: dto.source,
      },
    })

    return {
      serviceId: service.id,
      projectKey: dto.projectKey,
      controllersIngested: dto.controllers.length,
      endpointsIngested: dto.controllers.reduce(
        (sum, c) => sum + c.endpoints.length,
        0,
      ),
    }
  }

  async getIngestionHistory(serviceId: string, userId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { projectId: true },
    })
    if (!service) throw new NotFoundException(`Service ${serviceId} not found`)
    await this.assertProjectAccess(service.projectId, userId)

    return this.prisma.apiIngestionEvent.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
  }
}
