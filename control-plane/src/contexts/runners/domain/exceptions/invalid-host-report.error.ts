export class InvalidHostReportError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly field: string,
    rule: string,
  ) {
    super(`A host's ${field} ${rule}`);
    this.name = 'InvalidHostReportError';
  }
}
