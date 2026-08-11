import postgres from 'postgres';
import { DatabaseConfigService } from '../config/database.config';

interface ConsistencyCheck {
  readonly name: string;
  readonly sql: string;
}

const CHECKS: ReadonlyArray<ConsistencyCheck> = [
  {
    name: 'tickets sans demandeur externe valide',
    sql: `
      select count(*)::int as n from tickets t
      where t.requester_id is not null
        and not exists (
          select 1 from external_requesters r
          where r.id = t.requester_id and r.support_integration_id = t.support_integration_id
        )`,
  },
  {
    name: 'messages sans demandeur externe valide',
    sql: `
      select count(*)::int as n from support_messages m
      where m.external_requester_id is not null
        and not exists (
          select 1 from external_requesters r
          where r.id = m.external_requester_id and r.support_integration_id = m.support_integration_id
        )`,
  },
  {
    name: 'conversations sans intégration valide',
    sql: `
      select count(*)::int as n from support_conversations c
      where not exists (
        select 1 from support_integrations i where i.id = c.support_integration_id
      )`,
  },
  {
    name: 'outbox sans intégration valide',
    sql: `
      select count(*)::int as n from outbox_events e
      where not exists (
        select 1 from support_integrations i where i.id = e.support_integration_id
      )`,
  },
  {
    name: 'livraisons sans intégration ou outbox valide',
    sql: `
      select count(*)::int as n from external_deliveries d
      where not exists (select 1 from support_integrations i where i.id = d.support_integration_id)
         or not exists (select 1 from outbox_events e where e.id = d.outbox_event_id)`,
  },
  {
    name: 'identités sans demandeur externe valide',
    sql: `
      select count(*)::int as n from external_identities x
      where not exists (
        select 1 from external_requesters r
        where r.id = x.external_requester_id and r.support_integration_id = x.support_integration_id
      )`,
  },
  {
    name: 'appareils de confiance sans demandeur valide',
    sql: `
      select count(*)::int as n from trusted_devices d
      where not exists (
        select 1 from external_requesters r
        where r.id = d.external_requester_id and r.support_integration_id = d.support_integration_id
      )`,
  },
];

export async function runPhase9Checks(databaseUrl = new DatabaseConfigService().url): Promise<boolean> {
  const client = postgres(databaseUrl, { max: 1 });
  let failed = false;
  try {
    for (const check of CHECKS) {
      const [row] = await client.unsafe(check.sql);
      const count = Number(row?.n ?? 0);
      process.stdout.write(`${count === 0 ? 'OK  ' : 'FAIL'} ${check.name}: ${count}\n`);
      if (count > 0) failed = true;
    }
  } finally {
    await client.end();
  }
  if (failed) {
    process.stderr.write('Cohérence : des violations ont été détectées.\n');
    return false;
  }
  process.stdout.write('Cohérence : toutes les vérifications passent.\n');
  return true;
}

if (require.main === module) {
  runPhase9Checks()
    .then((passed) => {
      if (!passed) process.exitCode = 1;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Echec des vérifications: ${message}\n`);
      process.exitCode = 1;
    });
}
