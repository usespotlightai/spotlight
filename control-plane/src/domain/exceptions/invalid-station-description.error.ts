export class InvalidStationDescriptionError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A station description ${reason}`);
    this.name = 'InvalidStationDescriptionError';
  }
}
