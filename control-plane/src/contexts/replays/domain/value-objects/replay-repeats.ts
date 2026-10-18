export const MAX_REPEATS = 5;

export const isValidRepeatCount = (repeats: number): boolean =>
  Number.isInteger(repeats) && repeats >= 1 && repeats <= MAX_REPEATS;

export const CALIBRATION_REPEATS = 3;
