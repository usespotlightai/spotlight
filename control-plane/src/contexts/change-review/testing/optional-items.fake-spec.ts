export const optionalItems = <T>(
  items: readonly T[],
): readonly (T | undefined)[] => items;
