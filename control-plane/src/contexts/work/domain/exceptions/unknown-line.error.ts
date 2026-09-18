export class UnknownLineError extends Error {
  readonly violation = 'not-found' as const;

  constructor(lineId: string) {
    super(`There is no line ${lineId}`);
    this.name = 'UnknownLineError';
  }
}
