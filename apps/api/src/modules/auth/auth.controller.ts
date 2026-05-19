import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  Redirect,
} from '@nestjs/common'
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator'
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthService } from './auth.service'
import { User } from '@prisma/client'

class RegisterDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string
  @IsEmail() email: string
  @IsString() @MinLength(8) password: string
}

class LoginDto {
  @IsEmail() email: string
  @IsString() @MinLength(1) password: string
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get authenticated user profile' })
  getMe(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id)
  }

  @Post('register')
  @HttpCode(200)
  @ApiOperation({ summary: 'Register a new account with email & password' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.name, dto.email, dto.password)
  }

  @Get('verify-email')
  @Redirect()
  @ApiOperation({ summary: 'Verify email address via one-time link' })
  async verifyEmail(
    @Query('token') token: string,
    @Query('email') email: string,
  ) {
    const dashboardUrl = process.env.DASHBOARD_URL ?? 'http://localhost:3000'
    try {
      const url = await this.authService.verifyEmail(email, token)
      return { url, statusCode: 302 }
    } catch {
      return { url: `${dashboardUrl}/login?error=verification-failed`, statusCode: 302 }
    }
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Validate credentials (used by the Credentials auth provider)' })
  login(@Body() dto: LoginDto) {
    return this.authService.validateCredentials(dto.email, dto.password)
  }
}

