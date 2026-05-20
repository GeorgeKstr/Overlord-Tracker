import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { LabelsService } from './labels.service'
import { CreateLabelDto } from './dto/create-label.dto'
import { User } from '@prisma/client'

@ApiTags('labels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a label for a project' })
  create(@Body() dto: CreateLabelDto, @CurrentUser() user: User) {
    return this.labelsService.create(dto, user.id)
  }

  @Get()
  @ApiOperation({ summary: 'List labels for a project' })
  @ApiQuery({ name: 'projectId', required: true })
  findByProject(@Query('projectId') projectId: string, @CurrentUser() user: User) {
    return this.labelsService.findByProject(projectId, user.id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a label' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.labelsService.remove(id, user.id)
  }

  @Post('ticket/:ticketId/label/:labelId')
  @ApiOperation({ summary: 'Add label to ticket' })
  addToTicket(
    @Param('ticketId') ticketId: string,
    @Param('labelId') labelId: string,
    @CurrentUser() user: User,
  ) {
    return this.labelsService.addToTicket(ticketId, labelId, user.id)
  }

  @Delete('ticket/:ticketId/label/:labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove label from ticket' })
  removeFromTicket(
    @Param('ticketId') ticketId: string,
    @Param('labelId') labelId: string,
    @CurrentUser() user: User,
  ) {
    return this.labelsService.removeFromTicket(ticketId, labelId, user.id)
  }
}
