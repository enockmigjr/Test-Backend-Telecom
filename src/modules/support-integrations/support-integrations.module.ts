import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { SupportIntegrationsController } from './support-integrations.controller';
import { IntegrationSecretCipherService } from './services/integration-secret-cipher.service';
import { IntegrationSecretService } from './services/integration-secret.service';
import { SupportIntegrationsService } from './services/support-integrations.service';
import { IntegrationDeviceAdminService } from './services/integration-device-admin.service';
import { IntegrationTrustPolicyService } from './services/integration-trust-policy.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [SupportIntegrationsController],
  providers: [
    SupportIntegrationsService,
    IntegrationDeviceAdminService,
    IntegrationTrustPolicyService,
    IntegrationSecretCipherService,
    IntegrationSecretService,
  ],
  exports: [SupportIntegrationsService, IntegrationSecretCipherService, IntegrationSecretService],
})
export class SupportIntegrationsModule {}
