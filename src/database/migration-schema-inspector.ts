import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';
import {
  ActualColumn,
  ActualConstraint,
  readActualColumns,
  readActualConstraints,
  readActualIndexes,
} from './migration-catalog-reader';

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
interface SnapshotTable {
  name: string;
  columns: Record<string, SnapshotColumn>;
  indexes: Record<string, SnapshotIndex>;
  foreignKeys: Record<string, SnapshotForeignKey>;
  uniqueConstraints: Record<string, { name: string; columns: string[] }>;
}
interface Snapshot {
  tables: Record<string, SnapshotTable>;
}
interface ValidationOptions {
  ignoredColumns?: ReadonlySet<string>;
  ignoredIndexes?: ReadonlySet<string>;
  compatibleNullability?: ReadonlySet<string>;
}
type SnapshotFile = '0000_snapshot.json' | '0005_snapshot.json' | '0006_snapshot.json' | '0007_snapshot.json';

export async function findSchemaProblems(
  client: postgres.Sql,
  snapshotFile: SnapshotFile,
  options: ValidationOptions = {},
): Promise<string[]> {
  const [columns, constraints, indexes] = await Promise.all([
    readActualColumns(client),
    readActualConstraints(client),
    readActualIndexes(client),
  ]);
  const problems: string[] = [];
  for (const table of Object.values(readSnapshot(snapshotFile).tables)) {
    compareColumns(table, columns, constraints, options, problems);
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
      if (options.ignoredIndexes?.has(expected.name)) continue;
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
  return problems;
}

function compareColumns(
  table: SnapshotTable,
  columns: ActualColumn[],
  constraints: ActualConstraint[],
  options: ValidationOptions,
  problems: string[],
): void {
  for (const expected of Object.values(table.columns)) {
    const key = `${table.name}.${expected.name}`;
    if (options.ignoredColumns?.has(key)) continue;
    const actual = columns.find((column) => `${column.tableName}.${column.columnName}` === key);
    if (
      !actual ||
      normalizeType(actual.type) !== normalizeType(expected.type) ||
      (!options.compatibleNullability?.has(key) && actual.notNull !== expected.notNull)
    ) {
      problems.push(`column:${key}`);
      continue;
    }
    if (normalizeDefault(actual.defaultValue) !== normalizeDefault(expected.default)) problems.push(`default:${key}`);
    if (expected.primaryKey && !matchesConstraint(constraints, 'p', table.name, null, [expected.name], [])) {
      problems.push(`pk:${key}`);
    }
  }
}

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
      (!name || item.name === name.slice(0, 63)) &&
      (target === null || item.targetTable === target) &&
      same(item.sourceColumns, from) &&
      (to.length === 0 || same(item.targetColumns, to)),
  );
}
function same(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function normalizeType(value: string): string {
  return value.toLowerCase().replace('character varying', 'varchar').replaceAll('"', '');
}
function normalizeExpression(value: string): string {
  return value.replaceAll('"', '').replaceAll(' ', '').toLowerCase();
}
function normalizeDefault(value: unknown): string {
  return String(value ?? '')
    .replace(/::[\w\s".\[\]]+/g, '')
    .replace(/^\((.*)\)$/, '$1')
    .replaceAll(' ', '')
    .toLowerCase();
}
function readSnapshot(file: SnapshotFile): Snapshot {
  // Les deux noms autorisés sont une union fermée interne, jamais une entrée utilisateur.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const parsed: unknown = JSON.parse(readFileSync(join(process.cwd(), 'src/database/migrations/meta', file), 'utf8'));
  if (!isSnapshot(parsed)) throw new Error(`Empreinte de migration invalide: ${file}.`);
  return parsed;
}
function isSnapshot(value: unknown): value is Snapshot {
  return (
    typeof value === 'object' &&
    value !== null &&
    'tables' in value &&
    typeof value.tables === 'object' &&
    value.tables !== null
  );
}
