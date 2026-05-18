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
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { CommentsService } from './comments.service'
import { CreateCommentDto } from './dto/create-comment.dto'
import { User } from '@prisma/client'

@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({ summary: 'Add comment to a ticket' })
  create(@Body() dto: CreateCommentDto, @CurrentUser() user: User) {
    return this.commentsService.create(dto, user.id)
  }

  @Get()
  @ApiOperation({ summary: 'List comments for a ticket' })
  @ApiQuery({ name: 'ticketId', required: true })
  findByTicket(@Query('ticketId') ticketId: string, @CurrentUser() user: User) {
    return this.commentsService.findByTicket(ticketId, user.id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a comment (own only)' })
  @ApiParam({ name: 'id' })
  update(
    @Param('id') id: string,
    @Body('content') content: string,
    @CurrentUser() user: User,
  ) {
    return this.commentsService.update(id, content, user.id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a comment (own only)' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.commentsService.remove(id, user.id)
  }
}
