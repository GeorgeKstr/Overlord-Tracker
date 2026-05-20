import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ServicesService } from './services.service'
import { CreateServiceDto } from './dto/create-service.dto'
import { UpdateServiceDto } from './dto/update-service.dto'
import { User } from '@prisma/client'

class FindServicesQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string

  @IsOptional()
  @IsString()
  q?: string

  @IsOptional()
  @IsString()
  page?: string

  @IsOptional()
  @IsString()
  pageSize?: string
}

@ApiTags('services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @ApiOperation({ summary: 'Register a service' })
  create(@Body() dto: CreateServiceDto, @CurrentUser() user: User) {
    return this.servicesService.create(dto, user.id)
  }

  @Get()
  @ApiOperation({ summary: 'List all services (optionally filter by project)' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  findAll(@CurrentUser() user: User, @Query() query: FindServicesQueryDto) {
    const hasPaging = Boolean(query.page || query.pageSize)
    if (hasPaging) {
      return this.servicesService.findAllPaginated(user.id, {
        projectId: query.projectId,
        q: query.q,
        page: query.page ? Number(query.page) : undefined,
        pageSize: query.pageSize ? Number(query.pageSize) : undefined,
      })
    }
    if (query.projectId) return this.servicesService.findByProject(query.projectId, user.id, query.q)
    return this.servicesService.findAll(user.id, query.q)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get service by ID (includes controllers & endpoints)' })
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.servicesService.findOne(id, user.id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a service' })
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto, @CurrentUser() user: User) {
    return this.servicesService.update(id, dto, user.id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a service' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.servicesService.remove(id, user.id)
  }
}
