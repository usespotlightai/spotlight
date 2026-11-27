export const isOneOf = <T extends string>(
  values: readonly T[],
  value: unknown,
): value is T => values.some((each) => each === value);

export const oneOf = <T extends string>(
  values: readonly T[],
  value: unknown,
): T | undefined => values.find((each) => each === value);

export const isKeyOf = <T extends object>(
  record: T,
  key: PropertyKey,
): key is keyof T => Object.hasOwn(record, key);

export const keysOf = <T extends object>(
  record: T,
): Extract<keyof T, string>[] =>
  Object.keys(record).filter((key): key is Extract<keyof T, string> =>
    Object.hasOwn(record, key),
  );
