export class InvalidStationColorError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Station colour ${reason}.`);
    this.name = 'InvalidStationColorError';
  }
}
