import postgres from 'postgres';

export interface ActualColumn {
  tableName: string;
  columnName: string;
  type: string;
  notNull: boolean;
  defaultValue: string | null;
}

export interface ActualConstraint {
  name: string;
  type: 'p' | 'u' | 'f';
  tableName: string;
  targetTable: string | null;
  sourceColumns: string[];
  targetColumns: string[];
}

export interface ActualIndex {
  name: string;
  tableName: string;
  isUnique: boolean;
  method: string;
  columns: string[];
}

export async function readActualColumns(client: postgres.Sql): Promise<ActualColumn[]> {
  return client<ActualColumn[]>`
    SELECT c.relname AS "tableName", a.attname AS "columnName", format_type(a.atttypid, a.atttypmod) AS type,
      a.attnotnull AS "notNull", pg_get_expr(d.adbin, d.adrelid) AS "defaultValue"
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
  `;
}

export async function readActualConstraints(client: postgres.Sql): Promise<ActualConstraint[]> {
  return client<ActualConstraint[]>`
    SELECT con.conname AS name, con.contype AS type, source.relname AS "tableName", target.relname AS "targetTable",
      ARRAY(SELECT att.attname FROM unnest(con.conkey) WITH ORDINALITY key(attnum, ord)
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = key.attnum ORDER BY key.ord) AS "sourceColumns",
      ARRAY(SELECT att.attname FROM unnest(con.confkey) WITH ORDINALITY key(attnum, ord)
        JOIN pg_attribute att ON att.attrelid = con.confrelid AND att.attnum = key.attnum ORDER BY key.ord) AS "targetColumns"
    FROM pg_constraint con JOIN pg_class source ON source.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = source.relnamespace LEFT JOIN pg_class target ON target.oid = con.confrelid
    WHERE n.nspname = 'public' AND con.contype IN ('p', 'u', 'f')
  `;
}

export async function readActualIndexes(client: postgres.Sql): Promise<ActualIndex[]> {
  return client<ActualIndex[]>`
    SELECT idx.relname AS name, tbl.relname AS "tableName", i.indisunique AS "isUnique", am.amname AS method,
      ARRAY(SELECT pg_get_indexdef(i.indexrelid, position, true)
        FROM generate_series(1, i.indnkeyatts) position ORDER BY position) AS columns
    FROM pg_index i JOIN pg_class idx ON idx.oid = i.indexrelid JOIN pg_class tbl ON tbl.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = tbl.relnamespace JOIN pg_am am ON am.oid = idx.relam
    WHERE n.nspname = 'public' AND NOT i.indisprimary
  `;
}
