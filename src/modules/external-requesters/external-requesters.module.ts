import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ExternalRequestersController } from './external-requesters.controller';
import { ExternalRequestersAdminService } from './services/external-requesters-admin.service';
import { RetentionCleanupService } from './services/retention-cleanup.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [ExternalRequestersController],
  providers: [ExternalRequestersAdminService, RetentionCleanupService],
})
export class ExternalRequestersModule {}
