export class MemoryAlreadyDecidedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string, state: string) {
    super(`The memory ${id} was already ${state}, and is decided only once`);
    this.name = 'MemoryAlreadyDecidedError';
  }
}
