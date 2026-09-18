export class InvalidStationCheckError extends Error {
  constructor(reason: string) {
    super(`Invalid station check: ${reason}`);
    this.name = 'InvalidStationCheckError';
  }
}
