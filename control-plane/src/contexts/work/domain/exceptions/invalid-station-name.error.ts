export class InvalidStationNameError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Station name ${reason}.`);
    this.name = 'InvalidStationNameError';
  }
}
