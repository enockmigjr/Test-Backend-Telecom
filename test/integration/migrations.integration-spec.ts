import postgres from 'postgres';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { generateUuid } from '../../src/common/helpers/uuidv7.helper';
import { DatabaseConfigService } from '../../src/config/database.config';
import { baselineExistingSchema, runMigrations } from '../../src/database/run-migrations';

function databaseName(prefix: string): string {
  return `${prefix}_${generateUuid().replaceAll('-', '').slice(0, 16)}`;
}

function databaseUrl(baseUrl: string, name: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

describe('Migrations PostgreSQL', () => {
  const baseUrl = new DatabaseConfigService().url;
  const admin = postgres(baseUrl, { max: 1 });
  const createdDatabases: string[] = [];

  jest.setTimeout(120_000);

  afterAll(async () => {
    for (const name of createdDatabases) {
      await admin.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    }
    await admin.end();
  });

  it('applique la baseline et les migrations compatibles sur une base vide', async () => {
    const name = databaseName('telecom_migration');
    createdDatabases.push(name);
    await admin.unsafe(`CREATE DATABASE "${name}"`);
    const url = databaseUrl(baseUrl, name);

    await runMigrations(url);

    const client = postgres(url, { max: 1 });
    const [schema] = await client<
      {
        tables: number;
        slaColumns: number;
        familyColumns: number;
        tenantGuards: number;
        bootstrapConstraints: number;
      }[]
    >`
      SELECT
        (SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema = 'public') AS tables,
        (SELECT COUNT(*)::int FROM information_schema.columns
          WHERE table_name = 'tickets' AND column_name IN (
            'first_response_warning_sent_at', 'first_response_breached_at',
            'resolution_warning_sent_at', 'resolution_breached_at'
          )) AS "slaColumns",
        (SELECT COUNT(*)::int FROM information_schema.columns
          WHERE table_name = 'refresh_tokens' AND column_name = 'family_id') AS "familyColumns",
        (SELECT COUNT(*)::int FROM pg_trigger
          WHERE NOT tgisinternal AND tgname LIKE '%parent_integration_guard') AS "tenantGuards",
        (SELECT COUNT(*)::int FROM pg_constraint
          WHERE conrelid = 'public_bootstrap_grants'::regclass
            AND conname IN (
              'public_bootstrap_grants_integration_fk',
              'public_bootstrap_grants_requester_integration_fk',
              'public_bootstrap_grants_device_subject_fk',
              'public_bootstrap_grants_expiration_check'
            )) AS "bootstrapConstraints"
    `;
    expect(schema).toEqual({
      tables: 27,
      slaColumns: 4,
      familyColumns: 1,
      tenantGuards: 3,
      bootstrapConstraints: 4,
    });

    await client`DROP SCHEMA drizzle CASCADE`;
    await client.end();
    await runMigrations(url, true);
    const baselinedClient = postgres(url, { max: 1 });
    const [migrationState] = await baselinedClient<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM drizzle.__drizzle_migrations
    `;
    await baselinedClient.end();
    expect(migrationState?.count).toBe(10);
  });

  it('reprend une base peuplée et accepte encore les écritures du binaire N-1', async () => {
    const name = databaseName('telecom_expand');
    createdDatabases.push(name);
    await admin.unsafe(`CREATE DATABASE "${name}"`);
    const client = postgres(databaseUrl(baseUrl, name), { max: 1 });
    const migrations = readMigrationFiles({ migrationsFolder: 'src/database/migrations' });
    await applyMigrations(client, migrations.slice(0, 4));
    await seedLegacyRows(client, '00000000-0000-0000-0000-000000000101', 'INC-LEGACY-1');

    await applyMigrations(client, migrations.slice(4, 5));
    await seedLegacyTicket(client, '00000000-0000-0000-0000-000000000202', 'INC-LEGACY-2');
    await applyMigrations(client, migrations.slice(5, 6));

    const rows = await client<
      Array<{ id: string; createdBy: string | null; openedBy: string | null; sourceChannel: string }>
    >`
      SELECT id, created_by AS "createdBy", opened_by_user_id AS "openedBy", source_channel AS "sourceChannel"
      FROM tickets ORDER BY ticket_number
    `;
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.openedBy === row.createdBy && row.sourceChannel === 'INTERNAL')).toBe(true);

    const [actors] = await client<{ internalRows: number }[]>`
      SELECT (
        (SELECT COUNT(*) FROM ticket_comments WHERE actor_type = 'INTERNAL') +
        (SELECT COUNT(*) FROM ticket_history WHERE actor_type = 'INTERNAL') +
        (SELECT COUNT(*) FROM attachments WHERE actor_type = 'INTERNAL') +
        (SELECT COUNT(*) FROM audit_logs WHERE actor_type = 'INTERNAL') +
        (SELECT COUNT(*) FROM ticket_assignments WHERE actor_type = 'INTERNAL') +
        (SELECT COUNT(*) FROM idempotency_records WHERE subject_type = 'INTERNAL')
      )::int AS "internalRows"
    `;
    expect(actors?.internalRows).toBe(6);
    await client.end();
  });

  it('refuse de baseliner une base partielle', async () => {
    const name = databaseName('telecom_partial');
    createdDatabases.push(name);
    await admin.unsafe(`CREATE DATABASE "${name}"`);
    const client = postgres(databaseUrl(baseUrl, name), { max: 1 });
    const tableNames = [
      'attachments',
      'audit_logs',
      'categories',
      'departments',
      'notifications',
      'refresh_tokens',
      'reports',
      'settings',
      'sla_policies',
      'ticket_assignments',
      'ticket_comments',
      'ticket_history',
      'ticket_internal_notes',
      'tickets',
      'users',
    ];
    for (const tableName of tableNames) {
      await client.unsafe(`CREATE TABLE "${tableName}" (id uuid PRIMARY KEY)`);
    }

    await expect(baselineExistingSchema(client)).rejects.toThrow('incompatible avec baseline');
    await client.end();
  });
});

type Migration = ReturnType<typeof readMigrationFiles>[number];

async function applyMigrations(client: postgres.Sql, migrations: readonly Migration[]): Promise<void> {
  for (const migration of migrations) {
    await client.begin(async (transaction) => {
      for (const statement of migration.sql) await transaction.unsafe(statement);
    });
  }
}

async function seedLegacyRows(client: postgres.Sql, ticketId: string, ticketNumber: string): Promise<void> {
  await client`INSERT INTO departments (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Support migration')`;
  await client`
    INSERT INTO users (id, department_id, email, password_hash, first_name, last_name, role)
    VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
      'migration@telecom.local', 'hash', 'Agent', 'Migration', 'ADMINISTRATOR')
  `;
  await client`INSERT INTO categories (id, name) VALUES ('00000000-0000-0000-0000-000000000003', 'Migration')`;
  await client`
    INSERT INTO sla_policies (id, category_id, priority, first_response_minutes, resolution_minutes)
    VALUES ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'LOW', 60, 240)
  `;
  await seedLegacyTicket(client, ticketId, ticketNumber);
  const userId = '00000000-0000-0000-0000-000000000002';
  const departmentId = '00000000-0000-0000-0000-000000000001';
  await client`INSERT INTO ticket_comments (id, ticket_id, author_id, content)
    VALUES ('00000000-0000-0000-0000-000000000011', ${ticketId}, ${userId}, 'Commentaire')`;
  await client`INSERT INTO ticket_history (id, ticket_id, user_id, action)
    VALUES ('00000000-0000-0000-0000-000000000012', ${ticketId}, ${userId}, 'TICKET_CREATED')`;
  await client`INSERT INTO attachments (id, ticket_id, uploaded_by, object_key, original_filename, mime_type, file_size)
    VALUES ('00000000-0000-0000-0000-000000000013', ${ticketId}, ${userId}, 'legacy/file', 'file.txt', 'text/plain', 4)`;
  await client`INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id)
    VALUES ('00000000-0000-0000-0000-000000000014', ${userId}, 'CREATED', 'ticket', ${ticketId})`;
  await client`INSERT INTO ticket_assignments (id, ticket_id, to_user_id, to_department_id, assigned_by)
    VALUES ('00000000-0000-0000-0000-000000000015', ${ticketId}, ${userId}, ${departmentId}, ${userId})`;
  await client`INSERT INTO idempotency_records (key_hash, user_id, method, path, fingerprint, expires_at)
    VALUES ('legacy-key', ${userId}, 'POST', '/tickets', 'fingerprint', now() + interval '1 day')`;
}

async function seedLegacyTicket(client: postgres.Sql, ticketId: string, ticketNumber: string): Promise<void> {
  await client`
    INSERT INTO tickets (
      id, ticket_number, title, description, priority, severity, category_id, sla_policy_id,
      department_id, assigned_team_id, created_by, first_response_due_at, resolution_due_at
    ) VALUES (
      ${ticketId}, ${ticketNumber}, 'Ticket migration', 'Compatibilité N-1', 'LOW', 'S4',
      '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002', now() + interval '1 hour', now() + interval '4 hours'
    )
  `;
}
