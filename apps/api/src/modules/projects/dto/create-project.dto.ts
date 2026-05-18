import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
  IsIn,
  IsUrl,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

const PROJECT_STATUSES = ['ACTIVE', 'ARCHIVED', 'INACTIVE'] as const

export class CreateProjectDto {
  @ApiProperty({ example: 'My Platform' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string

  @ApiProperty({ example: 'my-platform', description: 'Lowercase slug, unique identifier' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'key must contain only lowercase letters, numbers, and hyphens',
  })
  key: string

  @ApiPropertyOptional({ example: 'Main platform project' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @ApiPropertyOptional({ enum: PROJECT_STATUSES, default: 'ACTIVE' })
  @IsOptional()
  @IsIn(PROJECT_STATUSES)
  status?: string

  @ApiPropertyOptional({ example: 'https://github.com/org/repo' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  gitRepoUrl?: string

  @ApiPropertyOptional({ example: 'https://myapp.com' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  websiteUrl?: string

  @ApiPropertyOptional({ example: 'Q2: ship billing migration and SSO' })
  @IsOptional()
  @IsString()
  roadmap?: string

  @ApiPropertyOptional({ example: 'erDiagram\n  USER ||--o{ PROJECT : owns' })
  @IsOptional()
  @IsString()
  entityGraph?: string

  @ApiPropertyOptional({ example: '# Project README\n\nArchitecture overview...' })
  @IsOptional()
  @IsString()
  readmeMd?: string

  @ApiPropertyOptional({ example: 'GET /api/health\nPOST /api/tickets' })
  @IsOptional()
  @IsString()
  apiSpec?: string
}
