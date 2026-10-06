export class LineMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `Line ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'LineMovedOnError';
  }
}
