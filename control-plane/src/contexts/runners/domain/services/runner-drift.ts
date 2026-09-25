interface EnrolledRunner {
  readonly name: string;
  readonly trustKey: string | null;
}

export interface Enrolment {
  readonly runners: readonly EnrolledRunner[];
  readonly trusts: readonly string[];
  readonly pools: readonly string[];
}

export interface DeclaredRunners {
  readonly runners: readonly string[];
  readonly trusts: readonly string[];
  readonly pools: readonly string[];
}

export interface RunnerDrift {
  readonly undeclared: readonly string[];
  readonly unknownRunners: readonly string[];
  readonly unknownTrusts: readonly string[];
  readonly unknownPools: readonly string[];
}

export const driftBetween = (
  declared: DeclaredRunners,
  enrolment: Enrolment,
): RunnerDrift => ({
  undeclared: enrolment.runners
    .filter(
      (each) =>
        !declared.runners.includes(each.name) &&
        !(each.trustKey !== null && declared.trusts.includes(each.trustKey)),
    )
    .map((each) => each.name),
  unknownRunners: declared.runners.filter(
    (name) => !enrolment.runners.some((each) => each.name === name),
  ),
  unknownTrusts: declared.trusts.filter(
    (key) => !enrolment.trusts.includes(key),
  ),
  unknownPools: declared.pools.filter((key) => !enrolment.pools.includes(key)),
});
