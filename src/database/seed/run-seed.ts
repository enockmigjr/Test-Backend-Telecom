import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as argon2 from 'argon2';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import * as schema from '../schemas';

const DATABASE_URL =
  process.env['DATABASE_URL'] || 'postgresql://telecom:telecom_secret@localhost:5432/telecom_tickets';

async function seed() {
  const client = postgres(DATABASE_URL);
  const db = drizzle(client, { schema });

  console.log('🌱 Démarrage du seed...\n');

  // ─── Départements ────────────────────────────────────────
  const deptData = [
    { name: 'Administration', description: 'Équipe administrative' },
    { name: 'Customer Care', description: 'Service client' },
    { name: 'NOC', description: 'Centre de Supervision Réseau' },
    { name: 'Billing', description: 'Service facturation' },
    { name: 'Technical Support', description: 'Support technique' },
    { name: 'Field Operations', description: 'Opérations terrain' },
  ];

  const deptIds: Record<string, string> = {};
  for (const d of deptData) {
    const id = generateUuid();
    deptIds[d.name] = id;
    await db.insert(schema.departments).values({ id, name: d.name, description: d.description }).onConflictDoNothing();
  }
  console.log('✅ Départements créés');

  // ─── Politiques SLA ──────────────────────────────────────
  const slaData = [
    { category: 'NETWORK', priority: 'CRITICAL', firstResponseMinutes: 15, resolutionMinutes: 120 },
    { category: 'NETWORK', priority: 'HIGH', firstResponseMinutes: 30, resolutionMinutes: 240 },
    { category: 'NETWORK', priority: 'MEDIUM', firstResponseMinutes: 60, resolutionMinutes: 480 },
    { category: 'NETWORK', priority: 'LOW', firstResponseMinutes: 120, resolutionMinutes: 1440 },
    { category: 'BILLING', priority: 'CRITICAL', firstResponseMinutes: 60, resolutionMinutes: 480 },
    { category: 'BILLING', priority: 'HIGH', firstResponseMinutes: 120, resolutionMinutes: 960 },
    { category: 'BILLING', priority: 'MEDIUM', firstResponseMinutes: 240, resolutionMinutes: 2880 },
    { category: 'BILLING', priority: 'LOW', firstResponseMinutes: 480, resolutionMinutes: 4320 },
    { category: 'TECHNICAL', priority: 'CRITICAL', firstResponseMinutes: 30, resolutionMinutes: 240 },
    { category: 'TECHNICAL', priority: 'HIGH', firstResponseMinutes: 60, resolutionMinutes: 480 },
    { category: 'TECHNICAL', priority: 'MEDIUM', firstResponseMinutes: 120, resolutionMinutes: 1440 },
    { category: 'TECHNICAL', priority: 'LOW', firstResponseMinutes: 240, resolutionMinutes: 2880 },
  ];

  for (const sla of slaData) {
    await db
      .insert(schema.slaPolicies)
      .values({
        id: generateUuid(),
        category: sla.category as typeof schema.slaPolicies.$inferSelect.category,
        priority: sla.priority as typeof schema.slaPolicies.$inferSelect.priority,
        firstResponseMinutes: sla.firstResponseMinutes,
        resolutionMinutes: sla.resolutionMinutes,
      })
      .onConflictDoNothing();
  }
  console.log('✅ Politiques SLA créées');

  // ─── Utilisateurs ────────────────────────────────────────
  const passwordHash = await argon2.hash('Agent@1234', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
  const adminHash = await argon2.hash('Admin@1234', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
  const supervisorHash = await argon2.hash('Super@1234', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const userData = [
    {
      email: 'admin@telecom.local',
      firstName: 'Admin',
      lastName: 'Système',
      role: 'ADMINISTRATOR',
      department: 'Administration',
      hash: adminHash,
    },
    {
      email: 'supervisor@telecom.local',
      firstName: 'Super',
      lastName: 'Viseur',
      role: 'SUPERVISOR',
      department: 'Customer Care',
      hash: supervisorHash,
    },
    {
      email: 'agent-cc@telecom.local',
      firstName: 'Alice',
      lastName: 'Dupont',
      role: 'CUSTOMER_SERVICE_AGENT',
      department: 'Customer Care',
      hash: passwordHash,
    },
    {
      email: 'noc@telecom.local',
      firstName: 'Bob',
      lastName: 'Martin',
      role: 'NOC_ENGINEER',
      department: 'NOC',
      hash: passwordHash,
    },
    {
      email: 'billing@telecom.local',
      firstName: 'Claire',
      lastName: 'Petit',
      role: 'BILLING_AGENT',
      department: 'Billing',
      hash: passwordHash,
    },
    {
      email: 'tech@telecom.local',
      firstName: 'David',
      lastName: 'Roux',
      role: 'TECHNICAL_SUPPORT_ENGINEER',
      department: 'Technical Support',
      hash: passwordHash,
    },
    {
      email: 'field@telecom.local',
      firstName: 'Emma',
      lastName: 'Moreau',
      role: 'FIELD_TECHNICIAN',
      department: 'Field Operations',
      hash: passwordHash,
    },
  ];

  for (const u of userData) {
    await db
      .insert(schema.users)
      .values({
        id: generateUuid(),
        email: u.email,
        passwordHash: u.hash,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role as typeof schema.users.$inferSelect.role,
        departmentId: deptIds[u.department],
      })
      .onConflictDoNothing();
  }
  console.log('✅ Utilisateurs créés');

  // ─── Séquence ticket_number ──────────────────────────────
  await client`CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1 INCREMENT 1`;

  console.log('\n🎉 Seed terminé avec succès !');
  console.log('   Comptes de test : voir README.md\n');
  await client.end();
}

seed().catch((err) => {
  console.error('❌ Erreur lors du seed:', err);
  process.exit(1);
});
