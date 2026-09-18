export class InvalidIntegrationPartError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    part: string,
    readonly because: string,
  ) {
    super(`An integration's ${part} ${because}`);
    this.name = 'InvalidIntegrationPartError';
  }
}
