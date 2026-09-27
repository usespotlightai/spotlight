export class UnknownMemoryError extends Error {
  readonly violation = 'not-found' as const;

  constructor(id: string) {
    super(`There is no memory ${id} for this caller`);
    this.name = 'UnknownMemoryError';
  }
}
