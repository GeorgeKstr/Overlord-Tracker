import { Type } from 'class-transformer'
import {
  IsString,
  IsArray,
  IsOptional,
  ValidateNested,
  MaxLength,
  IsIn,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class EndpointDto {
  @ApiProperty({ example: 'GET', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] })
  @IsString()
  @IsIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  method: string

  @ApiProperty({ example: '/' })
  @IsString()
  @MaxLength(500)
  path: string

  @ApiProperty({ example: 'listProjects' })
  @IsString()
  @MaxLength(100)
  handler: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string
}

export class ControllerDto {
  @ApiProperty({ example: 'ProjectController' })
  @IsString()
  @MaxLength(100)
  name: string

  @ApiProperty({ example: '/api/projects' })
  @IsString()
  @MaxLength(200)
  basePath: string

  @ApiProperty({ type: [EndpointDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EndpointDto)
  endpoints: EndpointDto[]
}

export class IngestControllersDto {
  @ApiProperty({ example: 'estate-dashboard', description: 'Project key' })
  @IsString()
  projectKey: string

  @ApiProperty({ example: 'core-api', description: 'Service slug' })
  @IsString()
  service: string

  @ApiProperty({ type: [ControllerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ControllerDto)
  controllers: ControllerDto[]

  @ApiPropertyOptional({ example: 'ci-pipeline', description: 'Ingestion source' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string
}
