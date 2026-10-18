export class InvalidHostReportError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: string,
    rule: string,
  ) {
    super(`Host ${field} ${rule}.`);
    this.name = 'InvalidHostReportError';
  }
}
