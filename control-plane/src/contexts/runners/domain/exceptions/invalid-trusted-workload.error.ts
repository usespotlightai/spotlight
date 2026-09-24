export class InvalidTrustedWorkloadError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly field: 'issuer' | 'subject' | 'audience',
    readonly because: string,
  ) {
    super(`A trusted workload's ${field} ${because}`);
    this.name = 'InvalidTrustedWorkloadError';
  }
}
