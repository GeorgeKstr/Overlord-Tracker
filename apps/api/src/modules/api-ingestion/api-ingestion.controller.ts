import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ApiIngestionService } from './api-ingestion.service'
import { IngestControllersDto } from './dto/ingest-controllers.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { User } from '@prisma/client'

@ApiTags('ingestion')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ingestion')
export class ApiIngestionController {
  constructor(private readonly apiIngestionService: ApiIngestionService) {}

  @Post('controllers')
  @ApiOperation({
    summary: 'Ingest controller/endpoint metadata for a service',
    description: 'Performs a full refresh of all controllers for the given service.',
  })
  ingestControllers(@Body() dto: IngestControllersDto, @CurrentUser() user: User) {
    return this.apiIngestionService.ingestControllers(dto, user.id)
  }

  @Get('history/:serviceId')
  @ApiOperation({ summary: 'Get ingestion event history for a service' })
  getHistory(@Param('serviceId') serviceId: string, @CurrentUser() user: User) {
    return this.apiIngestionService.getIngestionHistory(serviceId, user.id)
  }
}
