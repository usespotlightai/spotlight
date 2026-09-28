export const deepFrozen = <T>(held: T): T => {
  if (held && typeof held === 'object') {
    for (const each of Object.values(held)) {
      deepFrozen(each);
    }

    return Object.freeze(held);
  }

  return held;
};
