export class InvalidEgressError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: string,
    readonly because: string,
  ) {
    super(`Egress ${field} ${because}.`);
    this.name = 'InvalidEgressError';
  }
}
