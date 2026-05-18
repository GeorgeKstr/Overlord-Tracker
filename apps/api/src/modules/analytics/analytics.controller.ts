import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  @Get()
  @ApiOperation({ summary: 'Analytics overview (placeholder)' })
  getOverview() {
    return {
      message: 'Analytics module is a placeholder. Full implementation in Phase 2.',
    }
  }
}
