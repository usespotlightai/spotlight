export class MemoryAlreadyDecidedError extends Error {
  readonly kind = 'conflict' as const;

  constructor(id: string, state: string) {
    super(`Memory ${id} is already ${state}.`);
    this.name = 'MemoryAlreadyDecidedError';
  }
}
