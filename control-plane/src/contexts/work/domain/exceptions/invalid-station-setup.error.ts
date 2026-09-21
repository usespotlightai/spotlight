export class InvalidStationSetupError extends Error {
  constructor(reason: string) {
    super(`Invalid station setup: ${reason}`);
    this.name = 'InvalidStationSetupError';
  }
}
