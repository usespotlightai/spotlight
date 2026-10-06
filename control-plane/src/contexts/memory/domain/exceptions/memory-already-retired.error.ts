export class MemoryAlreadyRetiredError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(`Memory ${id} is already retired.`);
    this.name = 'MemoryAlreadyRetiredError';
  }
}
