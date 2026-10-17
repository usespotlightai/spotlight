export interface CredentialSourceKeys {
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
  existing: CredentialSourceKeys,
): RunnerDrift => ({
  unknownTrusts: declared.trusts.filter(
    (key) => !existing.trusts.includes(key),
  ),
  unknownPools: declared.pools.filter((key) => !existing.pools.includes(key)),
});
