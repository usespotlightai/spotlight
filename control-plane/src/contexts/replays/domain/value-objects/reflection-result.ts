export const REFLECTION_RESULTS = [
  'continued',
  'no-config-cause',
  'no-failures',
  'did-not-run',
  'ceiling-reached',
] as const;

export type ReflectionResult = (typeof REFLECTION_RESULTS)[number];
