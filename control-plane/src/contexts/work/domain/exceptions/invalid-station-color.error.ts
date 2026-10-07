export class InvalidStationColorError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Station colour ${reason}.`);
    this.name = 'InvalidStationColorError';
  }
}
