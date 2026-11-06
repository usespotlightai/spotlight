export interface PageCursor {
  readonly key: string;
  readonly id: string;
}

export interface PageRequest {
  readonly before: PageCursor | null;
  readonly limit: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly next: string | null;
}

export const PAGE_LIMIT = 50;

export const LONGEST_PAGE = 200;

export const FIRST_PAGE: PageRequest = { before: null, limit: PAGE_LIMIT };

export const encodeCursor = (cursor: PageCursor): string =>
  Buffer.from(JSON.stringify([cursor.key, cursor.id])).toString('base64url');

export const decodeCursor = (raw: string): PageCursor | null => {
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
  cursorOf: (row: T) => PageCursor,
): Page<T> => {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];

  return {
    items,
    next: rows.length > limit && last ? encodeCursor(cursorOf(last)) : null,
  };
};

export const mapPage = <T, U>(page: Page<T>, map: (item: T) => U): Page<U> => ({
  items: page.items.map(map),
  next: page.next,
});
