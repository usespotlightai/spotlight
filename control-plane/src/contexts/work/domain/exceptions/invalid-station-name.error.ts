export class InvalidStationNameError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A station name ${reason}`);
    this.name = 'InvalidStationNameError';
  }
}
