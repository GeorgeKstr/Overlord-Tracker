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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ServicesService } from './services.service'
import { CreateServiceDto } from './dto/create-service.dto'
import { UpdateServiceDto } from './dto/update-service.dto'
import { User } from '@prisma/client'

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
  findAll(@CurrentUser() user: User, @Query('projectId') projectId?: string) {
    if (projectId) return this.servicesService.findByProject(projectId, user.id)
    return this.servicesService.findAll(user.id)
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
