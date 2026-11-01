export class RunAlreadyExistsError extends Error {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(`A run with id ${id} already exists.`);
    this.name = 'RunAlreadyExistsError';
  }
}
