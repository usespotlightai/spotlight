export class UnknownAssemblyLineError extends Error {
  readonly violation = 'not-found' as const;

  constructor(lineId: string) {
    super(`There is no assembly line ${lineId}`);
    this.name = 'UnknownAssemblyLineError';
  }
}
