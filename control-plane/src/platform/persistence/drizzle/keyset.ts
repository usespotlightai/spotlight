import { type SQL, type SQLWrapper, sql } from 'drizzle-orm';

const SORTABLE_TIME = 'YYYY-MM-DD"T"HH24:MI:SS.US';

export const sortableTime = (column: SQLWrapper): SQL<string> =>
  sql<string>`to_char(${column}, ${SORTABLE_TIME})`;

export const isSortableTime = (key: string): boolean =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(key);

export const olderThan = (
  time: SQLWrapper,
  id: SQLWrapper,
  cursor: { readonly key: string; readonly id: string },
): SQL => sql`(${time}, ${id}) < (${cursor.key}::timestamp, ${cursor.id})`;

export const notNewerThan = (
  time: SQLWrapper,
  cursor: { readonly key: string },
): SQL => sql`${time} <= ${cursor.key}::timestamp`;

export const after = (
  key: SQLWrapper,
  id: SQLWrapper,
  cursor: { readonly key: string; readonly id: string },
): SQL => sql`(${key}, ${id}) > (${cursor.key}, ${cursor.id})`;
