export class InvalidStationChangeError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Station ${reason}.`);
    this.name = 'InvalidStationChangeError';
  }
}
