export class EmailInUseError extends Error {
  readonly kind = 'conflict' as const;

  constructor(email: string) {
    super(`${email} belongs to another Spotlight account.`);
    this.name = 'EmailInUseError';
  }
}
