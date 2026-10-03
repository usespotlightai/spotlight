export const andReset =
  <T>(set: (value: T) => void, reset: () => void) =>
  (value: T) => {
    set(value);
    reset();
  };
