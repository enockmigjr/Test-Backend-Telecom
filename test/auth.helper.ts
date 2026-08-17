/**
 * Helper d'authentification partagé — Keycloak-only (RS256/JWKS).
 *
 * Génère une paire RSA 2048 au chargement, expose la clé publique PEM (SPKI)
 * pour l'override de KeycloakJwksService et signe des jetons RS256 avec le
 * keyid 'test-key'. Les jetons utilisent les emails réels du seed
 * (src/database/seed/run-seed.ts) pour que la liaison par email vérifié
 * fonctionne sur la base de test.
 */
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import * as jwt from 'jsonwebtoken';

export const KEYCLOAK_TEST_ISSUER = 'http://keycloak.test/realms/telecom';
export const KEYCLOAK_TEST_JWKS_URL = `${KEYCLOAK_TEST_ISSUER}/protocol/openid-connect/certs`;
export const KEYCLOAK_TEST_KID = 'test-key';

const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });

export const keycloakPublicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();

/** Force un issuer déterministe de test avant compilation du module NestJS. */
export function configureKeycloakTestEnv(): void {
  process.env['KEYCLOAK_ISSUER'] = KEYCLOAK_TEST_ISSUER;
  process.env['KEYCLOAK_JWKS_URL'] = KEYCLOAK_TEST_JWKS_URL;
}

/** Override injectable pour KeycloakJwksService (résout toujours la clé de test). */
export const keycloakJwksOverride = {
  publicKey: async (): Promise<string> => keycloakPublicKeyPem,
};

/**
 * Override injectable pour KeycloakAdminService : évite tout appel réseau
 * vers le realm admin pendant les tests (création de comptes SSO, rôles).
 */
export const keycloakAdminOverride = {
  createUser: async (): Promise<string> => `kc-test-${randomUUID()}`,
  resetPassword: async (): Promise<void> => undefined,
  syncRealmRoles: async (): Promise<void> => undefined,
  ensureAccountRoles: async (): Promise<void> => undefined,
  setEnabled: async (): Promise<void> => undefined,
  listEvents: async (): Promise<Array<Record<string, unknown>>> => [],
};

export interface KeycloakTestTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  jti: string;
  iss: string;
  realm_access: { roles: string[] };
  exp: number;
}

/** Signe un jeton RS256 avec la clé privée de test (keyid 'test-key'). */
export function signKeycloakToken(payload: KeycloakTestTokenPayload): string {
  return jwt.sign(payload, keyPair.privateKey, { algorithm: 'RS256', keyid: KEYCLOAK_TEST_KID });
}

/** Construit un payload Keycloak valide, surchargeable. */
export function buildKeycloakPayload(overrides: Partial<KeycloakTestTokenPayload> = {}): KeycloakTestTokenPayload {
  return {
    sub: 'kc-test-user',
    email: 'admin@telecom.local',
    email_verified: true,
    jti: `jti-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    iss: process.env['KEYCLOAK_ISSUER'] ?? KEYCLOAK_TEST_ISSUER,
    realm_access: { roles: ['ADMINISTRATOR'] },
    exp: Math.floor(Date.now() / 1000) + 900,
    ...overrides,
  };
}

const SEEDED_USERS = {
  admin: { email: 'admin@telecom.local', role: 'ADMINISTRATOR' },
  csAgent: { email: 'agent-cc1@telecom.local', role: 'CUSTOMER_SERVICE_AGENT' },
  nocAgent: { email: 'noc1@telecom.local', role: 'NOC_ENGINEER' },
  technicalSupportAgent: { email: 'agent@telecom.local', role: 'TECHNICAL_SUPPORT_ENGINEER' },
  supervisor: { email: 'supervisor@telecom.local', role: 'SUPERVISOR' },
  supervisorNoc: { email: 'supervisor-noc@telecom.local', role: 'SUPERVISOR' },
  fieldTechnician: { email: 'field1@telecom.local', role: 'FIELD_TECHNICIAN' },
} as const;

export type SeededUserKey = keyof typeof SEEDED_USERS;

/** Jeton frais (exp +15 min) pour un utilisateur seedé. */
export function tokenFor(userKey: SeededUserKey): string {
  const user = SEEDED_USERS[userKey];
  return signKeycloakToken(
    buildKeycloakPayload({
      sub: `kc-test-${userKey}`,
      email: user.email,
      realm_access: { roles: [user.role] },
    }),
  );
}

/** Jetons prêts à l'emploi, régénérés à chaque accès (jamais expirés). */
export const testTokens = {
  admin: () => tokenFor('admin'),
  csAgent: () => tokenFor('csAgent'),
  nocAgent: () => tokenFor('nocAgent'),
  technicalSupportAgent: () => tokenFor('technicalSupportAgent'),
  supervisor: () => tokenFor('supervisor'),
  supervisorNoc: () => tokenFor('supervisorNoc'),
  fieldTechnician: () => tokenFor('fieldTechnician'),
} as const;
