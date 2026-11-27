export const SEARCH_STATES = [
  'seeding',
  'searching',
  'holding-out',
  'finished',
  'stopped',
] as const;

export type SearchState = (typeof SEARCH_STATES)[number];

const ACTIVE_SEARCH_STATES = [
  'seeding',
  'searching',
  'holding-out',
] as const satisfies readonly SearchState[];

export const isActiveSearchState = (state: SearchState): boolean =>
  (ACTIVE_SEARCH_STATES as readonly SearchState[]).includes(state);
