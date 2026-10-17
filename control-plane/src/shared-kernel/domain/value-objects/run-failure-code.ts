export const RUN_FAILURE_CODES = [
  'exited',
  'unprepared',
  'refused',
  'unprovisioned',
  'hooks-unanswered',
  'runner-lost',
  'timed-out',
  'cancelled',
  'superseded',
] as const;

export type RunFailureCode = (typeof RUN_FAILURE_CODES)[number];

export const isRunFailureCode = (code: string): code is RunFailureCode =>
  (RUN_FAILURE_CODES as readonly string[]).includes(code);
