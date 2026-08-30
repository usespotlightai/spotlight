export class InvalidStretchIdError extends Error {
  readonly violation = 'invalid' as const;

  constructor(value: string) {
    super(`${value} does not name a stretch of a task`);
    this.name = 'InvalidStretchIdError';
  }
}
