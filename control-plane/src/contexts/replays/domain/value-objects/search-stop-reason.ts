export const SEARCH_STOP_REASONS = [
  'iterations-spent',
  'ceiling-reached',
  'stalled',
  'stopped',
  'station-gone',
  'set-gone',
  'seed-failed',
] as const;

export type SearchStopReason = (typeof SEARCH_STOP_REASONS)[number];

const RAN_ITS_COURSE = [
  'iterations-spent',
  'ceiling-reached',
  'stalled',
] as const satisfies readonly SearchStopReason[];

export type SearchCourseStopReason = (typeof RAN_ITS_COURSE)[number];

export type SearchCutShort = Exclude<SearchStopReason, SearchCourseStopReason>;
