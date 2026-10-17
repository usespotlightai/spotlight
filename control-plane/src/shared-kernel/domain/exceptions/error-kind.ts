export const ERROR_KINDS = [
  'conflict',
  'invalid',
  'not-allowed',
  'not-found',
  'refused',
] as const;

export type ErrorKind = (typeof ERROR_KINDS)[number];
