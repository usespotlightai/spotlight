export class InvalidTrustedWorkloadError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: 'issuer' | 'subject' | 'audience',
    readonly because: string,
  ) {
    super(`Trusted workload ${field} ${because}.`);
    this.name = 'InvalidTrustedWorkloadError';
  }
}
