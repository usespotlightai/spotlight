export class InvalidReferralSourceError extends Error {
  readonly kind = 'invalid' as const;

  constructor(maxLength: number) {
    super(`Referral source must be at most ${maxLength} characters.`);
    this.name = 'InvalidReferralSourceError';
  }
}
