export class MemoryVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Memory ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'MemoryVersionConflictError';
  }
}
