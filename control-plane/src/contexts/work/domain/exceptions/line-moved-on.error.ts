export class LineMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `This line has changed since it was read, and cannot be written over (${id})`,
    );
    this.name = 'LineMovedOnError';
  }
}
