import { type SQL, type SQLWrapper, sql } from 'drizzle-orm';

export interface Cursor {
  readonly key: string;
  readonly id: string;
}

const SORTABLE_TIME = 'YYYY-MM-DD"T"HH24:MI:SS.US';

export const sortableTime = (column: SQLWrapper): SQL<string> =>
  sql<string>`to_char(${column} at time zone 'UTC', ${SORTABLE_TIME})`;

export const isSortableTime = (key: string): boolean =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(key);

export const encodeCursor = (cursor: Cursor): string =>
  Buffer.from(JSON.stringify([cursor.key, cursor.id])).toString('base64url');

export const decodeCursor = (raw: string): Cursor | null => {
  try {
    const parts: unknown = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    );

    return Array.isArray(parts) &&
      parts.length === 2 &&
      typeof parts[0] === 'string' &&
      typeof parts[1] === 'string'
      ? { key: parts[0], id: parts[1] }
      : null;
  } catch {
    return null;
  }
};

export const pageOf = <T>(
  rows: readonly T[],
  limit: number,
  cursorOf: (row: T) => Cursor,
): { items: readonly T[]; next: string | null } => {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];

  return {
    items,
    next: rows.length > limit && last ? encodeCursor(cursorOf(last)) : null,
  };
};

export const olderThan = (
  time: SQLWrapper,
  id: SQLWrapper,
  cursor: Cursor,
): SQL =>
  sql`(${time}, ${id}) < (${cursor.key}::timestamp at time zone 'UTC', ${cursor.id})`;

export const notNewerThan = (
  time: SQLWrapper,
  cursor: { readonly key: string },
): SQL => sql`${time} <= ${cursor.key}::timestamp at time zone 'UTC'`;

export const after = (key: SQLWrapper, id: SQLWrapper, cursor: Cursor): SQL =>
  sql`(${key}, ${id}) > (${cursor.key}, ${cursor.id})`;
