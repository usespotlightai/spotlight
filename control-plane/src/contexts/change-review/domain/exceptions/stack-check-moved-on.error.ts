export class StackCheckMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `This change stack check changed since it was read, and cannot be written over (${id})`,
    );
    this.name = 'StackCheckMovedOnError';
  }
}
