export class RunMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `This run has changed since it was read, and cannot be written over (${id})`,
    );
    this.name = 'RunMovedOnError';
  }
}
