export class InvalidHostReportError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly field: string,
    rule: string,
  ) {
    super(`Host ${field} ${rule}.`);
    this.name = 'InvalidHostReportError';
  }
}
