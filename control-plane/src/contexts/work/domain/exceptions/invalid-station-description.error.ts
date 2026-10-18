export class InvalidStationDescriptionError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Station description ${reason}.`);
    this.name = 'InvalidStationDescriptionError';
  }
}
