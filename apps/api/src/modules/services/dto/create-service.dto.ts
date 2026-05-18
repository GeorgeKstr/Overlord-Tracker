import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  IsUrl,
  IsIn,
  Matches,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

const SERVICE_STATUSES = ['HEALTHY', 'DEGRADED', 'DOWN', 'UNKNOWN'] as const

export class CreateServiceDto {
  @ApiProperty({ example: 'Core API' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string

  @ApiProperty({ example: 'core-api', description: 'URL-safe identifier' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @ApiPropertyOptional({ example: 'openapi: 3.0.0\ninfo:\n  title: Service API\n  version: 1.0.0' })
  @IsOptional()
  @IsString()
  apiSpec?: string

  @ApiPropertyOptional({ example: 'https://api.example.com' })
  @IsOptional()
  @IsUrl()
  baseUrl?: string

  @ApiPropertyOptional({ example: 'https://api.example.com/health' })
  @IsOptional()
  @IsUrl()
  healthUrl?: string

  @ApiPropertyOptional({ enum: SERVICE_STATUSES, default: 'UNKNOWN' })
  @IsOptional()
  @IsIn(SERVICE_STATUSES)
  status?: string

  @ApiProperty({ description: 'Project ID' })
  @IsString()
  projectId: string
}
