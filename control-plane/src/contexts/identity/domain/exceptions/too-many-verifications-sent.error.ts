export class TooManyVerificationsSentError extends Error {
  readonly kind = 'conflict' as const;

  constructor(most: number) {
    super(
      `Spotlight sent ${most} verification links for your account in the last hour, the most allowed. Please wait, then try again.`,
    );
    this.name = 'TooManyVerificationsSentError';
  }
}
