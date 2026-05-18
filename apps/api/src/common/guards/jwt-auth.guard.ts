import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Observable } from 'rxjs'
import { createHash } from 'crypto'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string }
      user?: unknown
    }>()

    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) {
      return super.canActivate(context)
    }

    const token = auth.slice('Bearer '.length).trim()
    if (!token.startsWith('ovl_pat_')) {
      return super.canActivate(context)
    }

    return this.validatePersonalToken(token, req)
  }

  private async validatePersonalToken(token: string, req: { user?: unknown }) {
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const now = new Date()

    const stored = await this.prisma.personalAccessToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    })

    if (!stored || stored.revokedAt || (stored.expiresAt && stored.expiresAt <= now)) {
      throw new UnauthorizedException('Invalid or expired personal token')
    }

    req.user = stored.user

    // Fire-and-forget usage timestamp update.
    this.prisma.personalAccessToken
      .update({ where: { id: stored.id }, data: { lastUsedAt: now } })
      .catch(() => undefined)

    return true
  }
}
