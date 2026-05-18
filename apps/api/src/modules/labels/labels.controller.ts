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
import { LabelsService } from './labels.service'
import { CreateLabelDto } from './dto/create-label.dto'

@ApiTags('labels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a label for a project' })
  create(@Body() dto: CreateLabelDto) {
    return this.labelsService.create(dto)
  }

  @Get()
  @ApiOperation({ summary: 'List labels for a project' })
  @ApiQuery({ name: 'projectId', required: true })
  findByProject(@Query('projectId') projectId: string) {
    return this.labelsService.findByProject(projectId)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a label' })
  remove(@Param('id') id: string) {
    return this.labelsService.remove(id)
  }

  @Post('ticket/:ticketId/label/:labelId')
  @ApiOperation({ summary: 'Add label to ticket' })
  addToTicket(
    @Param('ticketId') ticketId: string,
    @Param('labelId') labelId: string,
  ) {
    return this.labelsService.addToTicket(ticketId, labelId)
  }

  @Delete('ticket/:ticketId/label/:labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove label from ticket' })
  removeFromTicket(
    @Param('ticketId') ticketId: string,
    @Param('labelId') labelId: string,
  ) {
    return this.labelsService.removeFromTicket(ticketId, labelId)
  }
}
