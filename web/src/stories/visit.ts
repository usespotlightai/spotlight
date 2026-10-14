import type { Location } from 'react-router';

type Where = string | Partial<Location>;

type Visit = {
  readonly start: string;
  readonly moved: string | null;
};

let visit: Visit | null = null;

export const resumed = (where: Where): Where => {
  const start = JSON.stringify(where);

  if (visit?.start !== start) {
    visit = { start, moved: null };
  }

  return visit.moved ?? where;
};

export const movedTo = (path: string): void => {
  if (visit) {
    visit = { ...visit, moved: path };
  }
};
