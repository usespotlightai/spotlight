export class MemoryDraftMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `Memory draft ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'MemoryDraftMovedOnError';
  }
}
