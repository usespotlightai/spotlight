export class InvalidStationChangeError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Station ${reason}.`);
    this.name = 'InvalidStationChangeError';
  }
}
