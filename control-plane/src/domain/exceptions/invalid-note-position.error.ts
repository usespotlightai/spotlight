export class InvalidNotePositionError extends Error {
  readonly violation = 'invalid' as const;

  constructor(value: number) {
    super(`${value} is not a place in a task's trail`);
    this.name = 'InvalidNotePositionError';
  }
}
