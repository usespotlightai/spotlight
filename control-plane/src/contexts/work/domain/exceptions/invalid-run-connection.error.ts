export class InvalidRunConnectionError extends Error {
  readonly kind = 'invalid' as const;

  constructor(field: string, reason: string) {
    super(`The connection record ${field} ${reason}.`);
    this.name = 'InvalidRunConnectionError';
  }
}
