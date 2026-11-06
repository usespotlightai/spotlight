const PAGE = 50;

export const pageOf = <T>(
  items: readonly T[],
  request: Request,
  keyOf: (item: T) => string,
) => {
  const query = new URL(request.url).searchParams;
  const before = query.get('before');
  const limit = Number(query.get('limit') ?? PAGE);
  const from = before
    ? items.findIndex((item) => keyOf(item) === before) + 1
    : 0;
  const shown = items.slice(from, from + limit);
  const last = shown[shown.length - 1];

  return {
    items: shown,
    next: last && from + limit < items.length ? keyOf(last) : null,
  };
};
