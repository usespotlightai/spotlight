export class InvalidStationOrderError extends Error {
  constructor(reason: string) {
    super(`An assembly line's stations ${reason}`);
    this.name = 'InvalidStationOrderError';
  }
}
