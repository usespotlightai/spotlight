export const sameOrBothNone = <T extends { equals(other: T): boolean }>(
  a: T | null,
  b: T | null,
): boolean => (a === null || b === null ? a === b : a.equals(b));
