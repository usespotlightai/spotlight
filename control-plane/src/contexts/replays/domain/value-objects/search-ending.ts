export const SEARCH_ENDINGS = [
  'iterations-spent',
  'ceiling-reached',
  'stalled',
  'stopped',
  'station-gone',
  'set-gone',
  'seed-failed',
] as const;

export type SearchEnding = (typeof SEARCH_ENDINGS)[number];

const RAN_ITS_COURSE = [
  'iterations-spent',
  'ceiling-reached',
  'stalled',
] as const satisfies readonly SearchEnding[];

export type SearchCourseEnding = (typeof RAN_ITS_COURSE)[number];

export type SearchCutShort = Exclude<SearchEnding, SearchCourseEnding>;
