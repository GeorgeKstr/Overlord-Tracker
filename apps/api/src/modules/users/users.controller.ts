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
import { IsOptional, IsString, MinLength, IsInt, Min, Max } from 'class-validator'
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

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users' })
  findAll() {
    return this.usersService.findAll()
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
}
