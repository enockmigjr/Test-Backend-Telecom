import postgres from 'postgres';
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
    const [schema] = await client<{ tables: number; slaColumns: number; familyColumns: number }[]>`
      SELECT
        (SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema = 'public') AS tables,
        (SELECT COUNT(*)::int FROM information_schema.columns
          WHERE table_name = 'tickets' AND column_name IN (
            'first_response_warning_sent_at', 'first_response_breached_at',
            'resolution_warning_sent_at', 'resolution_breached_at'
          )) AS "slaColumns",
        (SELECT COUNT(*)::int FROM information_schema.columns
          WHERE table_name = 'refresh_tokens' AND column_name = 'family_id') AS "familyColumns"
    `;
    expect(schema).toEqual({ tables: 16, slaColumns: 4, familyColumns: 1 });

    await client`DROP SCHEMA drizzle CASCADE`;
    await client.end();
    await runMigrations(url, true);
    const baselinedClient = postgres(url, { max: 1 });
    const [migrationState] = await baselinedClient<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM drizzle.__drizzle_migrations
    `;
    await baselinedClient.end();
    expect(migrationState?.count).toBe(4);
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

    await expect(baselineExistingSchema(client)).rejects.toThrow('base existante est partielle ou incompatible');
    await client.end();
  });
});
