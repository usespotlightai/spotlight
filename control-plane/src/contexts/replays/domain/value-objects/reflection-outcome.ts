export const REFLECTION_OUTCOMES = [
  'went-on',
  'no-config-cause',
  'no-failures',
  'did-not-run',
  'out-of-budget',
] as const;

export type ReflectionOutcome = (typeof REFLECTION_OUTCOMES)[number];
