export const rounded = (value: number, places = 2): number =>
  Math.round(value * 10 ** places) / 10 ** places;

export const spread = (seed: string, low: number, high: number): number => {
  const sum = [...seed].reduce(
    (total, letter, place) => total + letter.charCodeAt(0) * (place + 7),
    0,
  );

  return low + ((sum % 97) / 96) * (high - low);
};

export const rateOf = (count: number, of: number): number | null =>
  of === 0 ? null : count / of;

export const medianOf = (values: readonly number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((one, other) => one - other);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

export const percentileOf = (
  values: readonly number[],
  percentile: number,
): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((one, other) => one - other);
  const place = Math.ceil((percentile / 100) * sorted.length) - 1;

  return sorted[Math.max(0, place)] ?? null;
};

export const dayOf = (iso: string): string => iso.slice(0, 10);
