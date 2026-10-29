export class ReplaySetEmptyError extends Error {
  readonly kind = 'conflict' as const;

  constructor(stationKey: string) {
    super(`Station ${stationKey} has no runs in its replay set yet.`);
    this.name = 'ReplaySetEmptyError';
  }
}
