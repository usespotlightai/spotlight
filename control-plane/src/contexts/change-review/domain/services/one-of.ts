export const isOneOf = <T extends string>(
  values: readonly T[],
  value: string,
): value is T => (values as readonly string[]).includes(value);
