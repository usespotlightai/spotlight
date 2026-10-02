export const SEARCH_STATES = [
  'seeding',
  'searching',
  'holding-out',
  'finished',
  'stopped',
] as const;

export type SearchState = (typeof SEARCH_STATES)[number];

export const ACTIVE_SEARCH_STATES = [
  'seeding',
  'searching',
  'holding-out',
] as const satisfies readonly SearchState[];
