/**
 * A hook is the deployment's own code rather than the agent's, and a plan is
 * the agent saying what it means to do before it does any of it.
 */
export const STEP_KINDS = [
  'said',
  'thought',
  'tool',
  'planned',
  'hook',
] as const;

export type StepKind = (typeof STEP_KINDS)[number];
