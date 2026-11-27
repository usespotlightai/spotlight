import { nonEmpty } from '@/lib/non-empty';
const PAGE = 50;

type Page<T> = { items: T[]; next: string | null };

export const pageOf = <T>(
  items: readonly T[],
  request: Request,
  keyOf: (item: T) => string,
): Page<T> => {
  const query = new URL(request.url).searchParams;
  const before = query.get('before');
  const limit = Number(query.get('limit') ?? PAGE);
  const from = nonEmpty(before)
    ? items.findIndex((item) => keyOf(item) === before) + 1
    : 0;
  const shown = items.slice(from, from + limit);
  const last = shown.at(-1);

  return {
    items: shown,
    next:
      last !== undefined && from + limit < items.length ? keyOf(last) : null,
  };
};
