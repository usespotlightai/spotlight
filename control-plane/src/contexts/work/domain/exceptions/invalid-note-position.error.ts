export class InvalidNotePositionError extends Error {
  readonly violation = 'invalid' as const;

  constructor(value: number | string) {
    super(`Task trail has no position ${value}.`);
    this.name = 'InvalidNotePositionError';
  }
}
