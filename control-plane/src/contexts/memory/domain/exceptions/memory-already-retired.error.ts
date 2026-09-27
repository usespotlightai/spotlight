export class MemoryAlreadyRetiredError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(`The memory ${id} was already retired`);
    this.name = 'MemoryAlreadyRetiredError';
  }
}
