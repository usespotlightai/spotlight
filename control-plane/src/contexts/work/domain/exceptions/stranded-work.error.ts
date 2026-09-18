export class StrandedWorkError extends Error {
  readonly violation = 'conflict' as const;

  constructor(stationIds: readonly string[]) {
    super(
      `Tasks still stand at ${stationIds.join(', ')}, so the line cannot drop them`,
    );
    this.name = 'StrandedWorkError';
  }
}
