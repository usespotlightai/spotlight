/** The reason is the only thing whoever wrote the file can act on. */
export class InvalidLinePlanError extends Error {
  readonly violation = 'invalid' as const;

  constructor(line: string, because: string) {
    super(`The ${line} line ${because}`);
    this.name = 'InvalidLinePlanError';
  }
}
