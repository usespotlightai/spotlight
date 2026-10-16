export class EgressInUseError extends Error {
  readonly violation = 'conflict' as const;

  constructor(
    key: string,
    readonly pools: readonly string[],
  ) {
    super(
      `Egress ${key} is in use. Runner pools that name it: ${pools.join(', ')}. Please remove provision.egress from these pools first.`,
    );
    this.name = 'EgressInUseError';
  }
}
