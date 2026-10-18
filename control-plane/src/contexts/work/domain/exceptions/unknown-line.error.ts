export class UnknownLineError extends Error {
  readonly kind = 'not-found' as const;

  constructor(lineId: string) {
    super(`Line ${lineId} not found.`);
    this.name = 'UnknownLineError';
  }
}
