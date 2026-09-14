export const STEP_KINDS = [
  'said',
  'thought',
  'tool',
  'planned',
  'hook',
] as const;

export type StepKind = (typeof STEP_KINDS)[number];
