import { InvalidRunPageError } from '@outcomes/domain/exceptions/invalid-run-page.error';

export const MOST_RUN_PAGE = 10_000;

export const pageAskedOf = (page: number): number => {
  if (page > MOST_RUN_PAGE) {
    throw new InvalidRunPageError(
      `must be at most ${MOST_RUN_PAGE}, not ${page}`,
    );
  }

  return page;
};

export const lastPageOf = (total: number, size: number): number =>
  Math.max(1, Math.ceil(total / size));

export const pageWithin = (page: number, total: number, size: number): void => {
  const last = lastPageOf(total, size);

  if (page > last) {
    throw new InvalidRunPageError(`must be at most ${last}, not ${page}`);
  }
};
