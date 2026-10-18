export class InvalidNotePositionError extends Error {
  readonly kind = 'invalid' as const;

  constructor(value: number | string) {
    super(`Task trail has no position ${value}.`);
    this.name = 'InvalidNotePositionError';
  }
}
