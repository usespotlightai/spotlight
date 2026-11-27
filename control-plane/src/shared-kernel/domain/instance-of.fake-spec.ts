export const instanceOf = <T>(
  kind: abstract new (...args: never[]) => T,
  value: unknown,
): T => {
  if (!(value instanceof kind)) {
    throw new Error(`expected a ${kind.name}`);
  }

  return value;
};
