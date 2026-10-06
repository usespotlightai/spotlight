export class InvalidStationNameError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Station name ${reason}.`);
    this.name = 'InvalidStationNameError';
  }
}
