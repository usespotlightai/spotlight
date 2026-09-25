export interface WaysIn {
  readonly trusts: readonly string[];
  readonly pools: readonly string[];
}

export interface DeclaredRunners {
  readonly trusts: readonly string[];
  readonly pools: readonly string[];
}

export interface RunnerDrift {
  readonly unknownTrusts: readonly string[];
  readonly unknownPools: readonly string[];
}

export const driftBetween = (
  declared: DeclaredRunners,
  waysIn: WaysIn,
): RunnerDrift => ({
  unknownTrusts: declared.trusts.filter((key) => !waysIn.trusts.includes(key)),
  unknownPools: declared.pools.filter((key) => !waysIn.pools.includes(key)),
});
