import { Module } from '@nestjs/common'
import { ApiIngestionController } from './api-ingestion.controller'
import { ApiIngestionService } from './api-ingestion.service'

@Module({
  controllers: [ApiIngestionController],
  providers: [ApiIngestionService],
})
export class ApiIngestionModule {}
