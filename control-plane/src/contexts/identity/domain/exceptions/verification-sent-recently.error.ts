export class VerificationSentRecentlyError extends Error {
  readonly kind = 'conflict' as const;

  constructor(email: string) {
    super(
      `A verification link was sent to ${email} less than a minute ago. Please wait, then try again.`,
    );
    this.name = 'VerificationSentRecentlyError';
  }
}
