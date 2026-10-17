export class StaleTaskRevisionError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string, expected: number, current: number) {
    super(
      `Task ${id} moved since revision ${expected}. Please reload and try again. Current revision: ${current}`,
    );
    this.name = 'StaleTaskRevisionError';
  }
}
