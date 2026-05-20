import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../../prisma/prisma.service'

interface JwtPayload {
  sub: string
  email: string
  name?: string
  picture?: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    })
  }

  async validate(payload: JwtPayload) {
    const adminEmail = this.config.get<string>('ADMIN_EMAIL')?.toLowerCase()
    const payloadEmail = payload.email?.toLowerCase()

    // If token email is the configured admin email, resolve by email first.
    // This prevents stale/mismatched token subjects from dropping admin access.
    if (adminEmail && payloadEmail === adminEmail) {
      const adminUser = await this.prisma.user.findUnique({
        where: { email: payload.email },
      })
      if (!adminUser) {
        throw new UnauthorizedException('User not found')
      }
      if (adminUser.role !== 'ADMIN' || adminUser.status !== 'APPROVED') {
        return this.prisma.user.update({
          where: { id: adminUser.id },
          data: { role: 'ADMIN', status: 'APPROVED' },
        })
      }
      return adminUser
    }

    let user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    if (adminEmail && user.email.toLowerCase() === adminEmail && (user.role !== 'ADMIN' || user.status !== 'APPROVED')) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN', status: 'APPROVED' },
      })
    }

    if (user.status !== 'APPROVED') {
      throw new ForbiddenException('Account pending approval')
    }

    return user
  }
}
