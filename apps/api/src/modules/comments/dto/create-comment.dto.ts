import { IsString, MaxLength, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateCommentDto {
  @ApiProperty({ example: 'This needs more context on the reproduce steps.' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string

  @ApiProperty({ description: 'Ticket ID' })
  @IsString()
  ticketId: string
}
