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
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger'
import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ProjectsService } from './projects.service'
import { CreateProjectDto } from './dto/create-project.dto'
import { UpdateProjectDto } from './dto/update-project.dto'
import { User } from '@prisma/client'

class AddMemberDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string

  @ApiPropertyOptional({ enum: ['ADMIN', 'MEMBER'], default: 'MEMBER' })
  @IsOptional()
  @IsIn(['ADMIN', 'MEMBER'])
  role?: string
}

const KNOWLEDGE_SECTIONS = ['roadmap', 'entityGraph', 'readmeMd', 'apiSpec'] as const
type KnowledgeSection = (typeof KNOWLEDGE_SECTIONS)[number]

class UpdateKnowledgeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roadmap?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityGraph?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readmeMd?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiSpec?: string
}

class IngestKnowledgeDto {
  @ApiProperty({ example: 'New parsed content from scanner' })
  @IsString()
  content: string

  @ApiPropertyOptional({ enum: ['replace', 'append'], default: 'replace' })
  @IsOptional()
  @IsIn(['replace', 'append'])
  mode?: 'replace' | 'append'

  @ApiPropertyOptional({ example: 'manual' })
  @IsOptional()
  @IsString()
  source?: string
}

class ProjectContextQueryDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'] })
  @IsOptional()
  @IsString()
  status?: string

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsString()
  priority?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string

  @ApiPropertyOptional({ description: 'Search term in title/description' })
  @IsOptional()
  @IsString()
  q?: string

  @ApiPropertyOptional({ description: 'Max number of tickets to return' })
  @IsOptional()
  @IsString()
  limit?: string
}

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: User) {
    return this.projectsService.create(dto, user.id)
  }

  @Get()
  @ApiOperation({ summary: 'List accessible projects' })
  findAll(@CurrentUser() user: User) {
    return this.projectsService.findAll(user.id)
  }

  @Get('agent-index')
  @ApiOperation({ summary: 'List accessible projects with API links for agent automation' })
  getAgentIndex(@CurrentUser() user: User) {
    return this.projectsService.getAgentIndex(user.id)
  }

  @Get(':id/context')
  @ApiOperation({ summary: 'Get project context (project + knowledge + filtered tickets)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'assigneeId', required: false })
  @ApiQuery({ name: 'q', required: false, description: 'Search title/description' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max tickets returned (1-200)' })
  getProjectContext(
    @Param('id') id: string,
    @Query() query: ProjectContextQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.getProjectContext(id, user.id, {
      status: query.status,
      priority: query.priority,
      assigneeId: query.assigneeId,
      q: query.q,
      limit: query.limit ? Number(query.limit) : undefined,
    })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.projectsService.findOne(id, user.id)
  }

  @Get('key/:key')
  @ApiOperation({ summary: 'Get project by key' })
  @ApiParam({ name: 'key', description: 'Project key' })
  findByKey(@Param('key') key: string, @CurrentUser() user: User) {
    return this.projectsService.findByKey(key, user.id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto, @CurrentUser() user: User) {
    return this.projectsService.update(id, dto, user.id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a project' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.projectsService.remove(id, user.id)
  }

  // ── Members ────────────────────────────────────────────────────────────────

  @Get(':id/members')
  @ApiOperation({ summary: 'List project members' })
  getMembers(@Param('id') id: string, @CurrentUser() user: User) {
    return this.projectsService.getMembers(id, user.id)
  }

  @Get(':id/agent-urls')
  @ApiOperation({ summary: 'Get API URL templates for agent automation' })
  getAgentUrls(@Param('id') id: string, @CurrentUser() user: User) {
    return this.projectsService.getAgentUrls(id, user.id)
  }

  @Patch(':id/knowledge')
  @ApiOperation({ summary: 'Update project roadmap/entity graph/readme/api docs' })
  updateKnowledge(
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeDto,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.updateKnowledge(id, dto, user.id)
  }

  @Post(':id/knowledge/:section/ingest')
  @ApiOperation({ summary: 'Ingest content into one project knowledge section' })
  ingestKnowledge(
    @Param('id') id: string,
    @Param('section') section: KnowledgeSection,
    @Body() dto: IngestKnowledgeDto,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.ingestKnowledge(id, section, dto.content, dto.mode ?? 'replace', user.id, dto.source)
  }

  @Get(':id/knowledge/history')
  @ApiOperation({ summary: 'List recent project knowledge history entries' })
  getKnowledgeHistory(@Param('id') id: string, @CurrentUser() user: User) {
    return this.projectsService.getKnowledgeHistory(id, user.id)
  }

  @Get(':id/knowledge/:section/history')
  @ApiOperation({ summary: 'List recent history for one knowledge section' })
  getKnowledgeSectionHistory(
    @Param('id') id: string,
    @Param('section') section: KnowledgeSection,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.getKnowledgeHistory(id, user.id, section)
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a collaborator by email' })
  addMember(
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.addMember(id, dto.email, dto.role ?? 'MEMBER', user.id)
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a collaborator' })
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.removeMember(id, memberId, user.id)
  }
}
