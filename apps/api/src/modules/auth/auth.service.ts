import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common'
import { randomBytes } from 'crypto'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../../prisma/prisma.service'
import { EmailService } from '../email/email.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
      },
    })
  }

  async register(name: string, emailAddress: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: emailAddress } })
    if (existing) {
      throw new ConflictException('An account with this email already exists.')
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const smtpConfigured = !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    )

    await this.prisma.user.create({
      data: {
        name,
        email: emailAddress,
        passwordHash,
        status: 'PENDING',
        // Auto-verify when no SMTP is configured so devs aren't blocked
        emailVerified: smtpConfigured ? null : new Date(),
      },
    })

    if (smtpConfigured) {
      const token = randomBytes(32).toString('hex')
      const expires = new Date(Date.now() + 60 * 60 * 1000)
      await this.prisma.verificationToken.create({
        data: { identifier: emailAddress, token, expires },
      })

      const apiUrl =
        process.env.API_URL ??
        `http://localhost:${process.env.PORT ?? 3001}`
      const verificationUrl = `${apiUrl}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(emailAddress)}`
      await this.email.sendVerificationEmail(emailAddress, verificationUrl)
    }

    return { emailVerificationRequired: smtpConfigured }
  }

  async verifyEmail(emailAddress: string, token: string): Promise<string> {
    const record = await this.prisma.verificationToken.findFirst({
      where: { identifier: emailAddress, token },
    })

    if (!record) throw new BadRequestException('Invalid or expired verification link.')

    if (record.expires < new Date()) {
      await this.prisma.verificationToken
        .delete({ where: { identifier_token: { identifier: emailAddress, token } } })
        .catch(() => null)
      throw new BadRequestException('This verification link has expired.')
    }

    await this.prisma.user.update({
      where: { email: emailAddress },
      data: { emailVerified: new Date() },
    })

    await this.prisma.verificationToken.delete({
      where: { identifier_token: { identifier: emailAddress, token } },
    })

    const dashboardUrl = process.env.DASHBOARD_URL ?? 'http://localhost:3000'
    return `${dashboardUrl}/login?verified=true`
  }

  async validateCredentials(emailAddress: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: emailAddress },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        passwordHash: true,
        emailVerified: true,
      },
    })

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.')
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Please verify your email address before signing in.')
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Invalid email or password.')

    const { passwordHash: _ph, emailVerified: _ev, ...safeUser } = user
    return safeUser
  }
}

