export class InvalidStationCheckError extends Error {
  constructor(reason: string) {
    super(`Station check ${reason}.`);
    this.name = 'InvalidStationCheckError';
  }
}
