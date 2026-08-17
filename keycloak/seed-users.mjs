/**
 * Seed Keycloak : crée 100+ comptes (rôles métier) dans le realm `telecom`.
 * Usage : KEYCLOAK_ADMIN=admin KEYCLOAK_ADMIN_PASSWORD=... node keycloak/seed-users.mjs
 * Nécessite : le conteneur keycloak démarré et le realm importé.
 */

const baseUrl = process.env.KEYCLOAK_URL ?? 'http://localhost:8081';
const realm = 'telecom';
const admin = process.env.KEYCLOAK_ADMIN ?? 'admin';
const password = process.env.KEYCLOAK_ADMIN_PASSWORD ?? 'Admin@1234';
const perRole = Number(process.env.SEED_PER_ROLE ?? 15);
const basePassword = process.env.SEED_PASSWORD ?? 'Telecom@2026!';

const roles = [
  'ADMINISTRATOR',
  'SUPERVISOR',
  'CUSTOMER_SERVICE_AGENT',
  'NOC_ENGINEER',
  'BILLING_AGENT',
  'TECHNICAL_SUPPORT_ENGINEER',
  'FIELD_TECHNICIAN',
];

// Rôles du client `account` requis par la console de compte Keycloak.
const ACCOUNT_CLIENT_ROLES = ['view-profile', 'manage-account'];

async function adminToken() {
  const res = await fetch(`${baseUrl}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: admin,
      password,
    }),
  });
  if (!res.ok) throw new Error(`Connexion admin Keycloak refusée (${res.status}).`);
  return (await res.json()).access_token;
}

async function createUser(token, index, role) {
  const username = `agent.${role.toLowerCase()}.${index}@telecom.local`;
  const res = await fetch(`${baseUrl}/admin/realms/${realm}/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email: username,
      firstName: `Agent ${index}`,
      lastName: role.replaceAll('_', ' '),
      enabled: true,
      emailVerified: true,
      credentials: [{ type: 'password', value: basePassword, temporary: false }],
    }),
  });
  if (res.status !== 201) {
    throw new Error(`Création ${username} échouée (${res.status}).`);
  }
  const location = res.headers.get('location');
  const userId = location?.split('/').pop();
  if (!userId) throw new Error(`ID utilisateur introuvable pour ${username}.`);
  const roleRes = await fetch(`${baseUrl}/admin/realms/${realm}/roles/${role}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const roleBody = await roleRes.json();
  await fetch(`${baseUrl}/admin/realms/${realm}/users/${userId}/role-mappings/realm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ id: roleBody.id, name: roleBody.name }]),
  });
  await assignAccountRoles(token, userId);
  return username;
}

async function assignAccountRoles(token, userId) {
  const clients = await (
    await fetch(`${baseUrl}/admin/realms/${realm}/clients`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();
  const account = clients.find((client) => client.clientId === 'account');
  if (!account) return;
  const accountRoles = await (
    await fetch(`${baseUrl}/admin/realms/${realm}/clients/${account.id}/roles`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();
  const toAssign = accountRoles.filter((r) => ACCOUNT_CLIENT_ROLES.includes(r.name));
  if (toAssign.length === 0) return;
  await fetch(`${baseUrl}/admin/realms/${realm}/users/${userId}/role-mappings/clients/${account.id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(toAssign.map(({ id, name }) => ({ id, name }))),
  });
}

const token = await adminToken();
const created = [];
for (const role of roles) {
  for (let index = 1; index <= perRole; index += 1) {
    created.push(await createUser(token, index, role));
  }
}
console.log(`Seed Keycloak terminé : ${created.length} comptes créés dans ${realm}.`);
