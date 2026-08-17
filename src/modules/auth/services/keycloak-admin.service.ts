import { Injectable, Logger } from '@nestjs/common';

export interface KeycloakUserInput {
  readonly username: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
}

interface KeycloakRole {
  readonly id: string;
  readonly name: string;
}

/**
 * Client de l'API admin Keycloak (provisionnement des comptes SSO).
 * Le compte bootstrap (KEYCLOAK_ADMIN / KEYCLOAK_ADMIN_PASSWORD) appartient au
 * realm `master` ; l'API REST cible ensuite le realm métier (`telecom`).
 */
@Injectable()
export class KeycloakAdminService {
  private readonly logger = new Logger(KeycloakAdminService.name);

  private endpoints(): { origin: string; realm: string } {
    const issuer = process.env.KEYCLOAK_INTERNAL_ISSUER ?? process.env.KEYCLOAK_ISSUER;
    if (!issuer) throw new Error('KEYCLOAK_INTERNAL_ISSUER est requis');
    const match = issuer.match(/\/realms\/([^/]+)$/);
    if (!match) throw new Error('KEYCLOAK_INTERNAL_ISSUER doit contenir /realms/{realm}');
    return { origin: new URL(issuer).origin, realm: match[1] };
  }

  private credentials(): { username: string; password: string } {
    const username = process.env.KEYCLOAK_ADMIN;
    const password = process.env.KEYCLOAK_ADMIN_PASSWORD;
    if (!username || !password) {
      throw new Error('KEYCLOAK_ADMIN et KEYCLOAK_ADMIN_PASSWORD sont requis');
    }
    return { username, password };
  }

  private async adminToken(): Promise<string> {
    const { origin } = this.endpoints();
    const { username, password } = this.credentials();
    const response = await fetch(`${origin}/realms/master/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username, password }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Jeton admin Keycloak refusé (${response.status})`);
    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }

  private async adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const { origin, realm } = this.endpoints();
    const token = await this.adminToken();
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${token}`);
    headers.set('content-type', 'application/json');
    const response = await fetch(`${origin}/admin/realms/${realm}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok && response.status !== 204) {
      throw new Error(`API admin Keycloak ${path} → ${response.status}`);
    }
    return response;
  }

  /** Crée le compte SSO actif (le mot de passe temporaire force le changement). */
  async createUser(input: KeycloakUserInput): Promise<string> {
    const response = await this.adminFetch('/users', {
      method: 'POST',
      body: JSON.stringify({
        username: input.username,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        enabled: true,
        emailVerified: true,
      }),
    });
    const location = response.headers.get('location');
    const id = location?.split('/').pop();
    if (!id) throw new Error('Création Keycloak : identifiant utilisateur introuvable');
    return id;
  }

  /** Mot de passe temporaire : `temporary: true` force le changement à la 1ère connexion. */
  async resetPassword(userId: string, value: string): Promise<void> {
    await this.adminFetch(`/users/${encodeURIComponent(userId)}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ type: 'password', value, temporary: true }),
    });
  }

  /** Remplace les rôles realm de l'utilisateur (mapping exact avec le profil métier). */
  async syncRealmRoles(userId: string, roleNames: readonly string[]): Promise<void> {
    const subject = encodeURIComponent(userId);
    const current = (await (await this.adminFetch(`/users/${subject}/role-mappings/realm`)).json()) as KeycloakRole[];
    const wanted = new Set(roleNames);
    const toRemove = current.filter((role) => !wanted.has(role.name));
    const toAddNames = roleNames.filter((name) => !current.some((role) => role.name === name));
    if (toRemove.length > 0) {
      await this.adminFetch(`/users/${subject}/role-mappings/realm`, {
        method: 'DELETE',
        body: JSON.stringify(toRemove),
      });
    }
    if (toAddNames.length > 0) {
      const realmRoles = (await (await this.adminFetch('/roles')).json()) as KeycloakRole[];
      const toAdd = realmRoles.filter((role) => toAddNames.includes(role.name));
      if (toAdd.length > 0) {
        await this.adminFetch(`/users/${subject}/role-mappings/realm`, {
          method: 'POST',
          body: JSON.stringify(toAdd),
        });
      }
    }
  }

  /** Active / désactive le compte SSO (bloque toute connexion). */
  async setEnabled(userId: string, enabled: boolean): Promise<void> {
    await this.adminFetch(`/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
  }

  /**
   * Assigne les rôles du client `account` (view-profile, manage-account) :
   * sans eux, la console de compte Keycloak répond 403 Forbidden.
   */
  async ensureAccountRoles(userId: string): Promise<void> {
    const subject = encodeURIComponent(userId);
    const clients = (await (await this.adminFetch('/clients')).json()) as Array<{ id: string; clientId: string }>;
    const account = clients.find((client) => client.clientId === 'account');
    if (!account) return;
    const accountRoles = (await (await this.adminFetch(`/clients/${account.id}/roles`)).json()) as KeycloakRole[];
    const wanted = accountRoles.filter((role) => ['view-profile', 'manage-account'].includes(role.name));
    if (wanted.length === 0) return;
    const current = (await (
      await this.adminFetch(`/users/${subject}/role-mappings/clients/${account.id}`)
    ).json()) as KeycloakRole[];
    const existing = new Set(current.map((role) => role.name));
    const missing = wanted.filter((role) => !existing.has(role.name));
    if (missing.length > 0) {
      await this.adminFetch(`/users/${subject}/role-mappings/clients/${account.id}`, {
        method: 'POST',
        body: JSON.stringify(missing.map(({ id, name }) => ({ id, name }))),
      });
    }
  }

  /** Liste les événements récents du realm (max 100), pour l'observabilité → audit_logs. */
  async listEvents(max = 100): Promise<Array<Record<string, unknown>>> {
    const bounded = Math.min(Math.max(max, 1), 100);
    const response = await this.adminFetch(`/events?max=${bounded}`);
    return (await response.json()) as Array<Record<string, unknown>>;
  }
}
