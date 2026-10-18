export class InvalidStationLayoutError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Line stations ${reason}.`);
    this.name = 'InvalidStationLayoutError';
  }
}
