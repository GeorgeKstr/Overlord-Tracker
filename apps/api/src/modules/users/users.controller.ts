import {
  Controller,
  Get,
  Param,
  UseGuards,
  Post,
  Body,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger'
import { IsOptional, IsString, MinLength, IsInt, Min, Max, IsIn } from 'class-validator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { UsersService } from './users.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { User } from '@prisma/client'

class CreatePersonalTokenDto {
  @IsString()
  @MinLength(3)
  name: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number
}

class UpdateUserRoleDto {
  @IsString()
  @IsIn(['USER', 'MODERATOR', 'ADMIN'])
  role: 'USER' | 'MODERATOR' | 'ADMIN'
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('pending')
  @ApiOperation({ summary: 'Admin: list pending sign-up requests' })
  findPending(@CurrentUser() user: User) {
    return this.usersService.findPending(user.id)
  }

  @Get()
  @ApiOperation({ summary: 'List all users' })
  findAll() {
    return this.usersService.findAll()
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  me(@CurrentUser() user: User) {
    return this.usersService.findById(user.id)
  }

  @Get('me/tokens')
  @ApiOperation({ summary: 'List personal API tokens for current user' })
  listTokens(@CurrentUser() user: User) {
    return this.usersService.listPersonalTokens(user.id)
  }

  @Post('me/tokens')
  @ApiOperation({ summary: 'Generate a new personal API token' })
  createToken(@CurrentUser() user: User, @Body() dto: CreatePersonalTokenDto) {
    return this.usersService.createPersonalToken(user.id, dto.name, dto.expiresInDays)
  }

  @Delete('me/tokens/:tokenId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a personal API token' })
  revokeToken(@CurrentUser() user: User, @Param('tokenId') tokenId: string) {
    return this.usersService.revokePersonalToken(user.id, tokenId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id)
  }

  @Post(':id/role')
  @ApiOperation({ summary: 'Admin: update user role' })
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() user: User,
  ) {
    return this.usersService.updateRole(user.id, id, dto.role)
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Admin: approve a pending sign-up' })
  approveUser(@Param('id') id: string, @CurrentUser() user: User) {
    return this.usersService.approveUser(user.id, id)
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Admin: reject and remove a pending sign-up' })
  rejectUser(@Param('id') id: string, @CurrentUser() user: User) {
    return this.usersService.rejectUser(user.id, id)
  }
}
