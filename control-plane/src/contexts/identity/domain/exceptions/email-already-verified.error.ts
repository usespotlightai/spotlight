export class EmailAlreadyVerifiedError extends Error {
  readonly kind = 'conflict' as const;

  constructor(email: string) {
    super(`${email} is already verified.`);
    this.name = 'EmailAlreadyVerifiedError';
  }
}
