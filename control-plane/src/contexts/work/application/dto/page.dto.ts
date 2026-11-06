export interface PageRequest {
  readonly before: string | null;
  readonly limit: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly next: string | null;
}

export const PAGE_LIMIT = 50;

export const LONGEST_PAGE = 200;

export const FIRST_PAGE: PageRequest = { before: null, limit: PAGE_LIMIT };

export const mapPage = <T, U>(page: Page<T>, map: (item: T) => U): Page<U> => ({
  items: page.items.map(map),
  next: page.next,
});
