import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private transporter: nodemailer.Transporter | null = null

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('SMTP_HOST')
    const port = config.get<number>('SMTP_PORT') ?? 587
    const user = config.get<string>('SMTP_USER')
    const pass = config.get<string>('SMTP_PASS')
    const from = config.get<string>('SMTP_FROM') ?? 'noreply@overlord.local'

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      })
      this.logger.log(`Email transport configured via ${host}:${port}`)
    } else {
      this.logger.warn(
        'SMTP_HOST / SMTP_USER / SMTP_PASS not set — emails will be logged to console only',
      )
    }
  }

  async sendVerificationEmail(to: string, verificationUrl: string) {
    const subject = 'Verify your email – Overlord Tracker'
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="margin-bottom:8px">Verify your email</h2>
        <p>Click the button below to confirm your email address and complete registration.</p>
        <p>
          <a href="${verificationUrl}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none">
            Verify email
          </a>
        </p>
        <p>This link expires in 1 hour.</p>
        <p style="color:#888;font-size:12px">If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `
    if (this.transporter) {
      const from = this.config.get<string>('SMTP_FROM') ?? 'noreply@overlord.local'
      await this.transporter.sendMail({ from, to, subject, html })
    } else {
      this.logger.log(`[EMAIL] Verification email | To: ${to} | URL: ${verificationUrl}`)
    }
  }

  async sendProjectInvitation(opts: {
    to: string
    inviterName: string
    projectName: string
    projectId: string
    appUrl: string
  }) {
    const { to, inviterName, projectName, projectId, appUrl } = opts
    const projectUrl = `${appUrl}/projects/${projectId}`

    const subject = `You've been invited to "${projectName}"`
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="margin-bottom:8px">Project invitation</h2>
        <p><strong>${inviterName}</strong> has invited you to collaborate on the project <strong>${projectName}</strong>.</p>
        <p>
          <a href="${projectUrl}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none">
            Open project
          </a>
        </p>
        <p style="color:#888;font-size:12px">If you didn't expect this, you can safely ignore this email.</p>
      </div>
    `

    if (this.transporter) {
      const from = this.config.get<string>('SMTP_FROM') ?? 'noreply@overlord.local'
      await this.transporter.sendMail({ from, to, subject, html })
    } else {
      // Dev fallback: log to console
      this.logger.log(`[EMAIL] To: ${to} | Subject: ${subject} | URL: ${projectUrl}`)
    }
  }
}
