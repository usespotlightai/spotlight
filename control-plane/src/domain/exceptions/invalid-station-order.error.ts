export class InvalidStationOrderError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`An assembly line's stations ${reason}`);
    this.name = 'InvalidStationOrderError';
  }
}
