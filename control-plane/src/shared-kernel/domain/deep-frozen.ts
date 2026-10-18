export const deepFrozen = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const each of Object.values(value)) {
      deepFrozen(each);
    }

    return Object.freeze(value);
  }

  return value;
};
