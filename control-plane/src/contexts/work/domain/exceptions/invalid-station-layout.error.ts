export class InvalidStationLayoutError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Line stations ${reason}.`);
    this.name = 'InvalidStationLayoutError';
  }
}
