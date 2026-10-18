export const STEP_KINDS = [
  'message',
  'thought',
  'tool',
  'planned',
  'hook',
] as const;

export type StepKind = (typeof STEP_KINDS)[number];
