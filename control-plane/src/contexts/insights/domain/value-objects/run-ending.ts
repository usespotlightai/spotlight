export const RUN_ENDINGS = [
  'completed',
  'failed',
  'stopped',
  'exhausted',
  'cancelled',
  'superseded',
] as const;

export type RunEnding = (typeof RUN_ENDINGS)[number];
