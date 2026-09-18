export class InvalidStationLayoutError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A line's stations ${reason}`);
    this.name = 'InvalidStationLayoutError';
  }
}
