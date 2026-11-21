import { PAGE_LIMIT } from '@shared-kernel/application/dto/page-limits.dto';

export interface PageRequest {
  readonly before: string | null;
  readonly limit: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly next: string | null;
}

export const FIRST_PAGE: PageRequest = { before: null, limit: PAGE_LIMIT };

export const mapPage = <T, U>(page: Page<T>, map: (item: T) => U): Page<U> => ({
  items: page.items.map(map),
  next: page.next,
});
