export class InvalidEmailAddressError extends Error {
  readonly kind = 'invalid' as const;

  constructor(raw: string) {
    super(`Email address is not valid. Received: ${raw}`);
    this.name = 'InvalidEmailAddressError';
  }
}
