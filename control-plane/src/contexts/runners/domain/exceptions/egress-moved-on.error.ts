export class EgressMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(egressId: string) {
    super(
      `Egress ${egressId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'EgressMovedOnError';
  }
}
