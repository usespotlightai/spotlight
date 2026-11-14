export const STEP_KINDS = [
  'message',
  'thought',
  'tool',
  'planned',
  'hook',
  'subagent',
  'waited',
  'lost',
  'reminded',
  'turn',
] as const;

export type StepKind = (typeof STEP_KINDS)[number];
