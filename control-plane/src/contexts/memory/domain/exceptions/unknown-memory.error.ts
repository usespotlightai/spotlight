export class UnknownMemoryError extends Error {
  readonly violation = 'not-found' as const;

  constructor(id: string) {
    super(`Memory ${id} not found.`);
    this.name = 'UnknownMemoryError';
  }
}
