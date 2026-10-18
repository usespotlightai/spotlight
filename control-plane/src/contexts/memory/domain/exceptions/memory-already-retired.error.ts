export class MemoryAlreadyRetiredError extends Error {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(`Memory ${id} is already retired.`);
    this.name = 'MemoryAlreadyRetiredError';
  }
}
