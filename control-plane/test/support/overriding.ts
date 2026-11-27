const inherits = <T extends object>(value: unknown, base: T): value is T =>
  typeof value === 'object' &&
  value !== null &&
  Object.getPrototypeOf(value) === base;

export const overriding = <T extends object>(base: T, over: Partial<T>): T => {
  const derived: unknown = Object.create(base);

  if (!inherits(derived, base)) {
    throw new Error('expected an object deriving from the base');
  }

  return Object.assign(derived, over);
};
