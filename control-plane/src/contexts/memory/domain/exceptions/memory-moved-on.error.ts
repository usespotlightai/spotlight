export class MemoryMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `Memory ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'MemoryMovedOnError';
  }
}
