export const MOST_REPEATS = 5;

export const holdsRepeats = (repeats: number): boolean =>
  Number.isInteger(repeats) && repeats >= 1 && repeats <= MOST_REPEATS;
