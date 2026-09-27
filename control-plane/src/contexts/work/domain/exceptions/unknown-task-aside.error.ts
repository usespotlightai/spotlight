export class UnknownTaskAsideError extends Error {
  readonly violation = 'not-found' as const;

  constructor(id: string) {
    super(`There is no task aside ${id} for this caller`);
    this.name = 'UnknownTaskAsideError';
  }
}
