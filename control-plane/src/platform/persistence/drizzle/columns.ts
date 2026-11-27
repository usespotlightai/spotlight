import { type SQL, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  numeric,
  type PgNumericNumberBuilderInitial,
  type PgTimestampBuilderInitial,
  timestamp,
} from 'drizzle-orm/pg-core';

export const timestamptz = (name: string): PgTimestampBuilderInitial<string> =>
  timestamp(name, { withTimezone: true, precision: 3, mode: 'date' });

export const amount = (name: string): PgNumericNumberBuilderInitial<string> =>
  numeric(name, { precision: 24, scale: 12, mode: 'number' });

export const literals = (values: readonly string[]): SQL =>
  sql.raw(values.map((value) => `'${value.replaceAll("'", "''")}'`).join(', '));

export const isCurrencyCode = (column: AnyPgColumn): SQL =>
  sql`${column} ~ '^[A-Z]{3}$'`;
