export class InvalidStationDescriptionError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Station description ${reason}.`);
    this.name = 'InvalidStationDescriptionError';
  }
}
