export class UnknownTaskAsideError extends Error {
  readonly violation = 'not-found' as const;

  constructor(id: string) {
    super(`Task aside ${id} not found.`);
    this.name = 'UnknownTaskAsideError';
  }
}
