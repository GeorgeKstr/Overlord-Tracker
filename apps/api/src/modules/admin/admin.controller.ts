import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AdminService } from './admin.service'
import { User } from '@prisma/client'

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('wipe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: wipe all data except ADMIN users' })
  wipe(@CurrentUser() user: User) {
    return this.adminService.wipeDatabase(user.id)
  }

  @Get('export')
  @ApiOperation({ summary: 'Admin: export all data as JSON snapshot' })
  export(@CurrentUser() user: User) {
    return this.adminService.exportDatabase(user.id)
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: import a full database snapshot (wipes first)' })
  import(@Body() body: unknown, @CurrentUser() user: User) {
    return this.adminService.importDatabase(user.id, body as never)
  }
}
