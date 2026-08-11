import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ExternalRequestersController } from './external-requesters.controller';
import { ExternalRequestersAdminService } from './services/external-requesters-admin.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [ExternalRequestersController],
  providers: [ExternalRequestersAdminService],
})
export class ExternalRequestersModule {}
