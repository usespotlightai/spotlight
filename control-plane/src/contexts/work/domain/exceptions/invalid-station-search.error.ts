export class InvalidStationSearchError extends Error {
  readonly kind = 'invalid' as const;

  constructor(because: string) {
    super(`Line ${because}.`);
    this.name = 'InvalidStationSearchError';
  }
}
