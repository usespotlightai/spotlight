export const RUN_ENDINGS = [
  'completed',
  'failed',
  'stopped',
  'exhausted',
  'cancelled',
  'superseded',
] as const;

export type RunEnding = (typeof RUN_ENDINGS)[number];

const WORK_ENDINGS: readonly RunEnding[] = ['completed', 'stopped'];

export const leftWork = (ending: RunEnding): boolean =>
  WORK_ENDINGS.includes(ending);
