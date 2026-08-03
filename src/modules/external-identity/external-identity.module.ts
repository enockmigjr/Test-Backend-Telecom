import { Module } from '@nestjs/common';
import { SupportIntegrationsModule } from '../support-integrations/support-integrations.module';
import { ExternalIdentityController } from './external-identity.controller';
import { PublicSessionGuard } from './guards/public-session.guard';
import { IntegrationAssertionGuard } from './guards/integration-assertion.guard';
import { CONTACT_VERIFICATION_PROVIDER } from './providers/contact-verification-provider.interface';
import { EmailContactVerificationProvider } from './providers/email-contact-verification.provider';
import { ContactVerificationService } from './services/contact-verification.service';
import { ExternalIdentityStoreService } from './services/external-identity-store.service';
import { PublicIdentityCryptoService } from './services/public-identity-crypto.service';
import { PublicRateLimitService } from './services/public-rate-limit.service';
import { PublicSessionService } from './services/public-session.service';
import { TrustedDeviceService } from './services/trusted-device.service';
import { BootstrapGrantService } from './services/bootstrap-grant.service';
import { IntegrationAssertionService } from './services/integration-assertion.service';
import { WordPressIdentityStoreService } from './services/wordpress-identity-store.service';
import { PublicTrustedDevicesController } from './public-trusted-devices.controller';

@Module({
  imports: [SupportIntegrationsModule],
  controllers: [ExternalIdentityController, PublicTrustedDevicesController],
  providers: [
    ContactVerificationService,
    BootstrapGrantService,
    ExternalIdentityStoreService,
    PublicIdentityCryptoService,
    PublicRateLimitService,
    PublicSessionService,
    PublicSessionGuard,
    IntegrationAssertionGuard,
    IntegrationAssertionService,
    WordPressIdentityStoreService,
    TrustedDeviceService,
    { provide: CONTACT_VERIFICATION_PROVIDER, useClass: EmailContactVerificationProvider },
  ],
  exports: [
    IntegrationAssertionGuard,
    PublicSessionGuard,
    PublicSessionService,
    PublicRateLimitService,
    TrustedDeviceService,
  ],
})
export class ExternalIdentityModule {}
