import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger'
import { IsString, IsBase64, MaxLength, IsMimeType } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AttachmentsService } from './attachments.service'
import { User } from '@prisma/client'

class CreateAttachmentDto {
  @ApiProperty({ example: 'screenshot.png' })
  @IsString()
  @MaxLength(255)
  filename: string

  @ApiProperty({ example: 'image/png' })
  @IsMimeType()
  mimeType: string

  @ApiProperty({ description: 'Base64-encoded file data' })
  @IsString()
  @IsBase64()
  data: string
}

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('tickets/:ticketId/attachments')
  @ApiOperation({ summary: 'Upload an image attachment to a ticket' })
  create(
    @Param('ticketId') ticketId: string,
    @Body() dto: CreateAttachmentDto,
    @CurrentUser() user: User,
  ) {
    return this.attachmentsService.create(ticketId, dto.filename, dto.mimeType, dto.data, user.id)
  }

  @Get('tickets/:ticketId/attachments')
  @ApiOperation({ summary: 'List attachments for a ticket' })
  findByTicket(@Param('ticketId') ticketId: string) {
    return this.attachmentsService.findByTicket(ticketId)
  }

  @Get('attachments/:id')
  @ApiOperation({ summary: 'Get a single attachment (includes base64 data)' })
  findOne(@Param('id') id: string) {
    return this.attachmentsService.findOne(id)
  }

  @Delete('attachments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an attachment' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.attachmentsService.remove(id, user.id)
  }
}
