import { AUTH_MODE_KEY, AuthMode } from '../../../common/decorators/auth-mode.decorator';
import { HealthController } from '../../../common/health/health.controller';
import { MetricsController } from '../../../common/metrics/metrics.controller';
import { AppController } from '../../app/app.controller';
import { ExternalIdentityController } from '../../external-identity/external-identity.controller';
import { PublicReportsController } from '../../reports/public-reports.controller';

describe('parité des routes anonymes et publiques', () => {
  const legacyAnonymousHandlers = [
    HealthController.prototype.liveness,
    HealthController.prototype.readiness,
    MetricsController.prototype.metrics,
    AppController.prototype.getApiInfo,
    PublicReportsController.prototype.download,
  ];

  it.each(legacyAnonymousHandlers)('conserve le mode ANONYMOUS pour %p', (handler) => {
    expect(Reflect.getMetadata(AUTH_MODE_KEY, handler)).toBe(AuthMode.ANONYMOUS);
  });

  it.each([
    [ExternalIdentityController.prototype.requestEmail, AuthMode.ANONYMOUS],
    [ExternalIdentityController.prototype.consumeEmail, AuthMode.ANONYMOUS],
    [ExternalIdentityController.prototype.exchangeAssertion, AuthMode.INTEGRATION_ASSERTION],
    [ExternalIdentityController.prototype.requestBootstrap, AuthMode.PUBLIC_SESSION],
    [ExternalIdentityController.prototype.consumeBootstrap, AuthMode.ANONYMOUS],
    [ExternalIdentityController.prototype.restore, AuthMode.PUBLIC_SESSION],
    [ExternalIdentityController.prototype.revokeDevice, AuthMode.PUBLIC_SESSION],
  ])('fige le mode du support public pour %p', (handler, expectedMode) => {
    expect(Reflect.getMetadata(AUTH_MODE_KEY, handler)).toBe(expectedMode);
  });
});
