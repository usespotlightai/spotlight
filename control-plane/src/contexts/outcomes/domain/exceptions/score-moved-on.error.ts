export class ScoreMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `This score changed since it was read, and cannot be written over (${id})`,
    );
    this.name = 'ScoreMovedOnError';
  }
}
