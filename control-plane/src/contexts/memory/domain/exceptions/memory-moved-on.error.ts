export class MemoryMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `This memory changed since it was read, and cannot be written over (${id})`,
    );
    this.name = 'MemoryMovedOnError';
  }
}
