import { IsString, MaxLength, MinLength, IsOptional, Matches } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateLabelDto {
  @ApiProperty({ example: 'bug' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string

  @ApiPropertyOptional({ example: '#ef4444', description: 'Hex color code' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex color (e.g. #ef4444)' })
  color?: string

  @ApiProperty({ description: 'Project ID' })
  @IsString()
  projectId: string
}
