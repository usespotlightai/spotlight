import { InvalidTokenTrustError } from '@identity/domain/exceptions/invalid-token-trust.error';

const MINUTE_MS = 60_000;

export class TokenLifetime {
  private readonly kind = 'token-lifetime';

  static readonly LONGEST_MINUTES = 60;

  static readonly USUAL_MINUTES = 15;

  private constructor(readonly minutes: number) {}

  static ofMinutes(minutes: number): TokenLifetime {
    if (
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > TokenLifetime.LONGEST_MINUTES
    ) {
      throw new InvalidTokenTrustError(
        'lifetimeMinutes',
        `must be a whole number of minutes from 1 to ${TokenLifetime.LONGEST_MINUTES}, as in ${TokenLifetime.USUAL_MINUTES}`,
      );
    }

    return new TokenLifetime(minutes);
  }

  endingFrom(now: Date): Date {
    return new Date(now.getTime() + this.minutes * MINUTE_MS);
  }

  equals(other: TokenLifetime): boolean {
    return this.kind === other.kind && this.minutes === other.minutes;
  }
}
