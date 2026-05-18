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
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { TicketsService } from './tickets.service'
import { CreateTicketDto } from './dto/create-ticket.dto'
import { UpdateTicketDto } from './dto/update-ticket.dto'
import { User } from '@prisma/client'

class FindTicketsQueryDto {
  @IsOptional()
  @IsString()
  projectId: string

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsString()
  priority?: string

  @IsOptional()
  @IsString()
  assigneeId?: string

  @IsOptional()
  @IsString()
  q?: string

  @IsOptional()
  @IsString()
  limit?: string
}

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a ticket (or subticket via parentTicketId)' })
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: User) {
    return this.ticketsService.create(dto, user.id)
  }

  @Get()
  @ApiOperation({ summary: 'List tickets (optionally filter by project)' })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter by project ID' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'assigneeId', required: false })
  @ApiQuery({ name: 'q', required: false, description: 'Search title/description' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max number of results' })
  findByProject(@Query() query: FindTicketsQueryDto, @CurrentUser() user: User) {
    if (!query.projectId) {
      return this.ticketsService.findAllAccessible(user.id, {
        status: query.status,
        priority: query.priority,
        assigneeId: query.assigneeId,
        q: query.q,
        limit: query.limit ? Number(query.limit) : undefined,
      })
    }

    return this.ticketsService.findByProject(query.projectId, user.id, {
      status: query.status,
      priority: query.priority,
      assigneeId: query.assigneeId,
      q: query.q,
      limit: query.limit ? Number(query.limit) : undefined,
    })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket by ID (includes subtickets and comments)' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ticketsService.findOne(id, user.id)
  }

  @Get(':id/subtickets')
  @ApiOperation({ summary: 'List subtickets of a ticket' })
  @ApiParam({ name: 'id', description: 'Parent ticket ID' })
  findSubtickets(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ticketsService.findSubtickets(id, user.id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a ticket' })
  update(@Param('id') id: string, @Body() dto: UpdateTicketDto, @CurrentUser() user: User) {
    return this.ticketsService.update(id, dto, user.id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a ticket' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ticketsService.remove(id, user.id)
  }
}
