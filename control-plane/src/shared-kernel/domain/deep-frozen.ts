export const deepFrozen = <T>(value: T): T => {
  if (typeof value === 'object' && value !== null) {
    for (const each of Object.values(value)) {
      deepFrozen(each);
    }

    return Object.freeze(value);
  }

  return value;
};
