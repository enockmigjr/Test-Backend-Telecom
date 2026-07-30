import postgres from 'postgres';
import { findSchemaProblems } from './migration-schema-inspector';

const COMPAT_COLUMNS = new Set([
  'tickets.first_response_warning_sent_at',
  'tickets.first_response_breached_at',
  'tickets.resolution_warning_sent_at',
  'tickets.resolution_breached_at',
]);
const COMPAT_INDEXES = new Set(['idx_tickets_first_response_breached', 'idx_tickets_resolution_breached']);
const COMPAT_NULLABILITY = new Set([
  'attachments.uploaded_by',
  'audit_logs.user_id',
  'tickets.created_by',
  'ticket_assignments.assigned_by',
  'ticket_comments.author_id',
  'ticket_history.user_id',
]);
const PUBLIC_EXPAND_CHECKS = [
  'external_challenges_attempts_check',
  'external_challenges_expiration_check',
  'trusted_devices_policy_version_check',
  'trusted_devices_expiration_check',
  'integration_credentials_versions_check',
  'support_conversations_ticket_created_state_check',
  'support_messages_actor_variant_check',
  'support_messages_canonical_content_check',
  'outbox_events_attempts_check',
  'external_deliveries_attempts_check',
  'attachments_parent_check',
  'attachments_actor_variant_check',
  'attachments_internal_note_actor_check',
  'audit_logs_actor_variant_check',
  'idempotency_records_subject_variant_check',
  'tickets_actor_presence_check',
  'tickets_legacy_creator_check',
  'tickets_requester_integration_check',
  'ticket_assignments_actor_variant_check',
  'ticket_comments_actor_variant_check',
  'ticket_history_actor_variant_check',
] as const;
const OUTBOX_ENVELOPE_CHECKS = ['outbox_events_actor_variant_check', 'outbox_events_schema_version_check'] as const;
const REQUIRED_VALIDATED_CHECKS = [
  'external_challenges_attempts_check',
  'external_challenges_expiration_check',
  'trusted_devices_policy_version_check',
  'trusted_devices_expiration_check',
  'integration_credentials_versions_check',
  'support_conversations_ticket_created_state_check',
  'support_messages_actor_variant_check',
  'support_messages_canonical_content_check',
  'outbox_events_attempts_check',
  'external_deliveries_attempts_check',
] as const;
const CHECK_TABLES: Readonly<Record<string, string>> = {
  external_challenges_attempts_check: 'external_verification_challenges',
  external_challenges_expiration_check: 'external_verification_challenges',
  trusted_devices_policy_version_check: 'trusted_devices',
  trusted_devices_expiration_check: 'trusted_devices',
  integration_credentials_versions_check: 'integration_credentials',
  support_conversations_ticket_created_state_check: 'support_conversations',
  support_messages_actor_variant_check: 'support_messages',
  support_messages_canonical_content_check: 'support_messages',
  outbox_events_attempts_check: 'outbox_events',
  outbox_events_actor_variant_check: 'outbox_events',
  outbox_events_schema_version_check: 'outbox_events',
  external_deliveries_attempts_check: 'external_deliveries',
  attachments_parent_check: 'attachments',
  attachments_actor_variant_check: 'attachments',
  attachments_internal_note_actor_check: 'attachments',
  audit_logs_actor_variant_check: 'audit_logs',
  idempotency_records_subject_variant_check: 'idempotency_records',
  tickets_actor_presence_check: 'tickets',
  tickets_legacy_creator_check: 'tickets',
  tickets_requester_integration_check: 'tickets',
  ticket_assignments_actor_variant_check: 'ticket_assignments',
  ticket_comments_actor_variant_check: 'ticket_comments',
  ticket_history_actor_variant_check: 'ticket_history',
};

export async function assertBaselineCompatible(client: postgres.Sql): Promise<void> {
  const problems = await findSchemaProblems(client, '0000_snapshot.json', {
    ignoredColumns: COMPAT_COLUMNS,
    ignoredIndexes: COMPAT_INDEXES,
    compatibleNullability: COMPAT_NULLABILITY,
  });
  assertNoProblems(problems, 'baseline');
}

export async function assertLatestSchemaCompatible(client: postgres.Sql): Promise<void> {
  const problems = await findSchemaProblems(client, '0007_snapshot.json');
  assertNoProblems(problems, 'dernier schema');
}

export async function assertPublicExpandSchemaCompatible(client: postgres.Sql): Promise<void> {
  const problems = await findSchemaProblems(client, '0005_snapshot.json');
  assertNoProblems(problems, 'schema public etendu');
}

export async function assertLatestPublicInvariants(client: postgres.Sql): Promise<boolean> {
  return assertPublicInvariants(
    client,
    [...PUBLIC_EXPAND_CHECKS, ...OUTBOX_ENVELOPE_CHECKS],
    [...REQUIRED_VALIDATED_CHECKS, ...OUTBOX_ENVELOPE_CHECKS],
  );
}

export async function assertPublicExpandInvariants(client: postgres.Sql): Promise<boolean> {
  return assertPublicInvariants(client, PUBLIC_EXPAND_CHECKS, REQUIRED_VALIDATED_CHECKS);
}

export async function hasParentIntegrationGuards(client: postgres.Sql): Promise<boolean> {
  const [state] = await client<{ complete: boolean }[]>`
    WITH expected(table_name, trigger_name, function_name) AS (VALUES
      ('ticket_comments', 'ticket_comments_parent_integration_guard', 'enforce_ticket_child_integration'),
      ('ticket_history', 'ticket_history_parent_integration_guard', 'enforce_ticket_child_integration'),
      ('attachments', 'attachments_parent_integration_guard', 'enforce_attachment_parent_integration')
    )
    SELECT COUNT(*) = 3 AND bool_and(trigger.tgenabled <> 'D') AS complete
    FROM expected
    JOIN pg_class relation ON relation.relname = expected.table_name
    JOIN pg_namespace relation_namespace ON relation_namespace.oid = relation.relnamespace
      AND relation_namespace.nspname = 'public'
    JOIN pg_trigger trigger ON trigger.tgrelid = relation.oid
      AND trigger.tgname = expected.trigger_name AND NOT trigger.tgisinternal
    JOIN pg_proc function ON function.oid = trigger.tgfoid AND function.proname = expected.function_name
    JOIN pg_namespace function_namespace ON function_namespace.oid = function.pronamespace
      AND function_namespace.nspname = 'public'
  `;
  return state?.complete ?? false;
}

async function assertPublicInvariants(
  client: postgres.Sql,
  requiredChecks: readonly string[],
  validatedChecks: readonly string[],
): Promise<boolean> {
  const constraints = await client<{ name: string; tableName: string; validated: boolean }[]>`
    SELECT c.conname AS name, r.relname AS "tableName", c.convalidated AS validated
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public' AND c.contype = 'c'
  `;
  const byName = new Map(
    constraints.map((constraint) => [`${constraint.tableName}.${constraint.name}`, constraint.validated]),
  );
  const keyFor = (name: string) => `${CHECK_TABLES[name]}.${name}`;
  const missing = requiredChecks.filter((name) => !byName.has(keyFor(name)));
  if (missing.length > 0) throw new Error(`Contraintes publiques manquantes: ${missing.join(', ')}.`);
  const unvalidated = validatedChecks.filter((name) => byName.get(keyFor(name)) !== true);
  if (unvalidated.length > 0) {
    throw new Error(`Contraintes publiques non validees: ${unvalidated.join(', ')}.`);
  }
  const [state] = await client<{ complete: boolean }[]>`
    SELECT NOT EXISTS (
      SELECT 1 FROM tickets WHERE created_by IS NOT NULL AND opened_by_user_id IS NULL
    ) AS complete
  `;
  return state?.complete ?? false;
}

function assertNoProblems(problems: readonly string[], target: string): void {
  if (problems.length === 0) return;
  throw new Error(`La base est incompatible avec ${target}: ${problems.join(', ')}.`);
}
