export interface ParetoPoint {
  readonly cost: number;
  readonly value: number;
}

export const dominates = (
  one: ParetoPoint,
  other: ParetoPoint,
  higherIsBetter: boolean,
): boolean => {
  const better = higherIsBetter
    ? one.value >= other.value
    : one.value <= other.value;
  const strictly = higherIsBetter
    ? one.value > other.value
    : one.value < other.value;

  return (
    one.cost <= other.cost && better && (one.cost < other.cost || strictly)
  );
};
