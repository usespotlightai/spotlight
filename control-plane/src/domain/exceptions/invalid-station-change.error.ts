export class InvalidStationChangeError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`The station ${reason}`);
    this.name = 'InvalidStationChangeError';
  }
}
