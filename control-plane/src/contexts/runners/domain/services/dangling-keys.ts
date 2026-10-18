export interface CredentialSourceKeys {
  readonly trusts: readonly string[];
  readonly pools: readonly string[];
}

export interface DeclaredRunners {
  readonly trusts: readonly string[];
  readonly pools: readonly string[];
}

export interface DanglingKeys {
  readonly unknownTrusts: readonly string[];
  readonly unknownPools: readonly string[];
}

export const danglingKeysBetween = (
  declared: DeclaredRunners,
  existing: CredentialSourceKeys,
): DanglingKeys => ({
  unknownTrusts: declared.trusts.filter(
    (key) => !existing.trusts.includes(key),
  ),
  unknownPools: declared.pools.filter((key) => !existing.pools.includes(key)),
});
