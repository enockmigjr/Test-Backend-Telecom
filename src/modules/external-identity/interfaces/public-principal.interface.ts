export interface PublicPrincipal {
  readonly kind: 'PUBLIC';
  readonly sub: string;
  readonly externalRequesterId: string;
  readonly supportIntegrationId: string;
  readonly deviceId?: string;
  readonly jti: string;
}
