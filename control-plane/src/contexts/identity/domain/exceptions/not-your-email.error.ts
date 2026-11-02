export class NotYourEmailError extends Error {
  readonly kind = 'not-allowed' as const;

  constructor(email: string) {
    super(
      `${email} was added by another account. Please sign in as that account to verify it.`,
    );
    this.name = 'NotYourEmailError';
  }
}
