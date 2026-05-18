import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { ProjectsModule } from './modules/projects/projects.module'
import { TicketsModule } from './modules/tickets/tickets.module'
import { CommentsModule } from './modules/comments/comments.module'
import { LabelsModule } from './modules/labels/labels.module'
import { ServicesModule } from './modules/services/services.module'
import { ApiIngestionModule } from './modules/api-ingestion/api-ingestion.module'
import { HealthModule } from './modules/health/health.module'
import { AnalyticsModule } from './modules/analytics/analytics.module'
import { AttachmentsModule } from './modules/attachments/attachments.module'
import { EmailModule } from './modules/email/email.module'
import { AppController } from './app.controller'

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EmailModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TicketsModule,
    CommentsModule,
    LabelsModule,
    ServicesModule,
    ApiIngestionModule,
    HealthModule,
    AnalyticsModule,
    AttachmentsModule,
  ],
})
export class AppModule {}
