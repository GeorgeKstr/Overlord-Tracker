import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  IsIn,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'] as const
const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

export class CreateTicketDto {
  @ApiProperty({ example: 'Fix login redirect bug' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string

  @ApiPropertyOptional({ example: 'When the user logs in, they are redirected to 404.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string

  @ApiPropertyOptional({ enum: TICKET_STATUSES, default: 'OPEN' })
  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: string

  @ApiPropertyOptional({ enum: TICKET_PRIORITIES, default: 'MEDIUM' })
  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: string

  @ApiProperty({ example: 'clxyz123', description: 'Project ID' })
  @IsString()
  projectId: string

  @ApiPropertyOptional({ example: 'clxyz456', description: 'Assignee user ID' })
  @IsOptional()
  @IsString()
  assigneeId?: string

  @ApiPropertyOptional({ example: 'clxyzservice1', description: 'Related service ID' })
  @IsOptional()
  @IsString()
  serviceId?: string

  @ApiPropertyOptional({ example: 'clxyz789', description: 'Parent ticket ID (for subtickets)' })
  @IsOptional()
  @IsString()
  parentTicketId?: string
}
