export class InvalidLinePlanError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    line: string,
    because: string,
    readonly at: string = 'the file',
  ) {
    super(`The ${line} line ${because}`);
    this.name = 'InvalidLinePlanError';
  }
}
