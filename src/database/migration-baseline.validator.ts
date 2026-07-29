/**
 * ============================================================================
 * FICHIER : src/database/migration-baseline.validator.ts
 * RÔLE : Validateur d'empreinte de schéma PostgreSQL et de compatibilité Baseline Drizzle.
 * EXPLICATION :
 * Ce module vérifie que la base de données PostgreSQL de production est conforme au schéma Drizzle :
 * 1. Inspecte les catalogues système PostgreSQL (`pg_attribute`, `pg_constraint`, `pg_index`).
 * 2. Compare les colonnes, types de données, contraintes d'intégrité (PK, FK, Unique) et index avec le fichier d'empreinte Drizzle (`0000_snapshot.json`).
 * 3. Lève une erreur si la base existante présente une structure incompatible ou partielle avant de marquer la baseline comme exécutée.
 * ============================================================================
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

interface SnapshotColumn {
  name: string;
  type: string;
  notNull: boolean;
  default?: unknown;
  primaryKey: boolean;
}
interface SnapshotIndex {
  name: string;
  columns: Array<{ expression: string }>;
  isUnique: boolean;
  method: string;
}
interface SnapshotForeignKey {
  name: string;
  tableTo: string;
  columnsFrom: string[];
  columnsTo: string[];
}
interface SnapshotUnique {
  name: string;
  columns: string[];
}
interface SnapshotTable {
  name: string;
  columns: Record<string, SnapshotColumn>;
  indexes: Record<string, SnapshotIndex>;
  foreignKeys: Record<string, SnapshotForeignKey>;
  uniqueConstraints: Record<string, SnapshotUnique>;
}
interface Snapshot {
  tables: Record<string, SnapshotTable>;
}
interface ActualColumn {
  tableName: string;
  columnName: string;
  type: string;
  notNull: boolean;
  defaultValue: string | null;
}
interface ActualConstraint {
  name: string;
  type: 'p' | 'u' | 'f';
  tableName: string;
  targetTable: string | null;
  sourceColumns: string[];
  targetColumns: string[];
}
interface ActualIndex {
  name: string;
  tableName: string;
  isUnique: boolean;
  method: string;
  columns: string[];
}

/** Colonnes exemptées de validation stricte pour rétrocompatibilité lors des migrations évolutives. */
const COMPAT_COLUMNS = new Set([
  'tickets.first_response_warning_sent_at',
  'tickets.first_response_breached_at',
  'tickets.resolution_warning_sent_at',
  'tickets.resolution_breached_at',
]);

/** Index exemptés de validation stricte pour rétrocompatibilité. */
const COMPAT_INDEXES = new Set(['idx_tickets_first_response_breached', 'idx_tickets_resolution_breached']);

/**
 * Valide que la base de données PostgreSQL est compatible avec l'empreinte snapshot Drizzle.
 *
 * @param client Client SQL `postgres` connecté.
 * @throws Error si des incompatibilités structurelles (colonnes, types, clés, index) sont détectées.
 */
export async function assertBaselineCompatible(client: postgres.Sql): Promise<void> {
  const tables = Object.values(readSnapshot().tables);
  const columns = await actualColumns(client);
  const constraints = await actualConstraints(client);
  const indexes = await actualIndexes(client);
  const problems: string[] = [];

  for (const table of tables) {
    for (const expected of Object.values(table.columns)) {
      const key = `${table.name}.${expected.name}`;
      if (COMPAT_COLUMNS.has(key)) continue;
      const actual = columns.find((column) => `${column.tableName}.${column.columnName}` === key);
      if (
        !actual ||
        normalizeType(actual.type) !== normalizeType(expected.type) ||
        actual.notNull !== expected.notNull
      ) {
        problems.push(`column:${key}`);
        continue;
      }
      if (normalizeDefault(actual.defaultValue) !== normalizeDefault(expected.default)) {
        problems.push(`default:${key}`);
      }
      if (expected.primaryKey && !matchesConstraint(constraints, 'p', table.name, null, [expected.name], [])) {
        problems.push(`pk:${key}`);
      }
    }
    for (const expected of Object.values(table.foreignKeys)) {
      if (
        !matchesConstraint(
          constraints,
          'f',
          table.name,
          expected.tableTo,
          expected.columnsFrom,
          expected.columnsTo,
          expected.name,
        )
      ) {
        problems.push(`fk:${expected.name}`);
      }
    }
    for (const expected of Object.values(table.uniqueConstraints)) {
      if (!matchesConstraint(constraints, 'u', table.name, null, expected.columns, [], expected.name)) {
        problems.push(`unique:${expected.name}`);
      }
    }
    for (const expected of Object.values(table.indexes)) {
      if (COMPAT_INDEXES.has(expected.name)) continue;
      const actual = indexes.find((index) => index.name === expected.name && index.tableName === table.name);
      const expectedColumns = expected.columns.map((column) => normalizeExpression(column.expression));
      if (
        !actual ||
        actual.isUnique !== expected.isUnique ||
        actual.method !== expected.method ||
        !same(actual.columns.map(normalizeExpression), expectedColumns)
      ) {
        problems.push(`index:${expected.name}`);
      }
    }
  }
  if (problems.length > 0) throw new Error('La base existante est partielle ou incompatible; baseline refusée.');
}

/** Interroge le catalogue `pg_attribute` de PostgreSQL pour extraire les colonnes et types effectifs. */
async function actualColumns(client: postgres.Sql): Promise<ActualColumn[]> {
  return client<ActualColumn[]>`
    SELECT c.relname AS "tableName", a.attname AS "columnName",
      format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS "notNull",
      pg_get_expr(d.adbin, d.adrelid) AS "defaultValue"
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
  `;
}

/** Interroge le catalogue `pg_constraint` pour extraire les contraintes PK, FK et Uniques. */
async function actualConstraints(client: postgres.Sql): Promise<ActualConstraint[]> {
  return client<ActualConstraint[]>`
    SELECT con.conname AS name, con.contype AS type, source.relname AS "tableName",
      target.relname AS "targetTable",
      ARRAY(SELECT att.attname FROM unnest(con.conkey) WITH ORDINALITY key(attnum, ord)
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = key.attnum ORDER BY key.ord) AS "sourceColumns",
      ARRAY(SELECT att.attname FROM unnest(con.confkey) WITH ORDINALITY key(attnum, ord)
        JOIN pg_attribute att ON att.attrelid = con.confrelid AND att.attnum = key.attnum ORDER BY key.ord) AS "targetColumns"
    FROM pg_constraint con JOIN pg_class source ON source.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = source.relnamespace LEFT JOIN pg_class target ON target.oid = con.confrelid
    WHERE n.nspname = 'public' AND con.contype IN ('p', 'u', 'f')
  `;
}

/** Interroge le catalogue `pg_index` pour extraire les index et leurs colonnes associées. */
async function actualIndexes(client: postgres.Sql): Promise<ActualIndex[]> {
  return client<ActualIndex[]>`
    SELECT idx.relname AS name, tbl.relname AS "tableName", i.indisunique AS "isUnique", am.amname AS method,
      ARRAY(SELECT pg_get_indexdef(i.indexrelid, position, true)
        FROM generate_series(1, i.indnkeyatts) position ORDER BY position) AS columns
    FROM pg_index i JOIN pg_class idx ON idx.oid = i.indexrelid JOIN pg_class tbl ON tbl.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = tbl.relnamespace JOIN pg_am am ON am.oid = idx.relam
    WHERE n.nspname = 'public' AND NOT i.indisprimary
  `;
}

/** Vérifie si une contrainte correspond aux paramètres attendus. */
function matchesConstraint(
  all: ActualConstraint[],
  type: ActualConstraint['type'],
  table: string,
  target: string | null,
  from: string[],
  to: string[],
  name?: string,
): boolean {
  return all.some(
    (item) =>
      item.type === type &&
      item.tableName === table &&
      (!name || item.name === name) &&
      (target === null || item.targetTable === target) &&
      same(item.sourceColumns, from) &&
      (to.length === 0 || same(item.targetColumns, to)),
  );
}

/** Compare la stricte égalité de deux tableaux de chaînes de caractères. */
function same(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/** Normalise la représentation textuelle d'un type SQL. */
function normalizeType(value: string): string {
  return value.toLowerCase().replace('character varying', 'varchar').replaceAll('"', '');
}

/** Normalise la représentation textuelle d'une expression d'index SQL. */
function normalizeExpression(value: string): string {
  return value.replaceAll('"', '').replaceAll(' ', '').toLowerCase();
}

/** Normalise la valeur par défaut d'une colonne SQL. */
function normalizeDefault(value: unknown): string {
  return String(value ?? '')
    .replace(/::[\w\s".\[\]]+/g, '')
    .replace(/^\((.*)\)$/, '$1')
    .replaceAll(' ', '')
    .toLowerCase();
}

/** Lit et décode le fichier d'empreinte snapshot Drizzle `0000_snapshot.json`. */
function readSnapshot(): Snapshot {
  const path = join(process.cwd(), 'src/database/migrations/meta/0000_snapshot.json');
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!isSnapshot(parsed)) throw new Error('Empreinte de baseline invalide.');
  return parsed;
}

/** Prédicat de validation de la structure du fichier JSON snapshot. */
function isSnapshot(value: unknown): value is Snapshot {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('tables' in value) ||
    typeof value.tables !== 'object' ||
    value.tables === null
  )
    return false;
  return Object.values(value.tables).every(
    (table) =>
      typeof table === 'object' &&
      table !== null &&
      'name' in table &&
      'columns' in table &&
      'indexes' in table &&
      'foreignKeys' in table &&
      'uniqueConstraints' in table,
  );
}
