export class ChangesUnguardedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(stationKey: string) {
    super(
      `No replay set guards the changes of the station ${stationKey}, so a planned change of it has nothing to replay; flag one of its replay sets as guarding changes`,
    );
    this.name = 'ChangesUnguardedError';
  }
}
