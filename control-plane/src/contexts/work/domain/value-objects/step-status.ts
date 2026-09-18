export const STEP_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
] as const;

export type StepStatus = (typeof STEP_STATUSES)[number];

export const faulted = (status: string | null | undefined): boolean =>
  status === 'failed';
