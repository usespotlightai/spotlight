export class InvalidStationColorError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A station color ${reason}`);
    this.name = 'InvalidStationColorError';
  }
}
