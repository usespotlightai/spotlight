import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

export class HostGrant {
  private constructor(
    readonly accessToken: string,
    readonly refreshToken: string | null,
    readonly expiresAt: Date | null,
    readonly scopes: readonly string[],
    readonly handle: string | null,
  ) {}

  static of(input: {
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: Date | null;
    scopes?: readonly string[];
    handle?: string | null;
  }): HostGrant {
    const token = input.accessToken.trim();

    if (token.length === 0) {
      throw new InvalidIdentifierError(
        'host grant',
        'has a token to act with, which a host that granted access always gives',
      );
    }

    return new HostGrant(
      token,
      input.refreshToken?.trim() || null,
      input.expiresAt ?? null,
      input.scopes ?? [],
      input.handle?.trim() || null,
    );
  }
}
