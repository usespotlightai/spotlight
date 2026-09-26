export class StaleTaskRevisionError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string, expected: number, standing: number) {
    super(
      `This task has moved since revision ${expected}, and stands at revision ${standing}, so a move based on what it was is refused (${id})`,
    );
    this.name = 'StaleTaskRevisionError';
  }
}
