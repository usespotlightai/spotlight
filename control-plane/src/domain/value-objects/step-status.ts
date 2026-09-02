/**
 * What a step came to. A protocol may say more than this, so a status is read
 * rather than trusted, but a fault is a step that failed wherever it is read.
 */
export const STEP_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
] as const;

export type StepStatus = (typeof STEP_STATUSES)[number];

export const faulted = (status: string | null | undefined): boolean =>
  status === 'failed';
