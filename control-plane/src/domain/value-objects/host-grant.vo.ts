import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

/**
 * What a host hands back when a team authorizes it: a token to act with, a
 * token to get the next one, when the first goes stale, what was granted, and
 * the name the host now knows the team by. The one thing every grant must have
 * is a token to act with; a host that gives none has granted nothing.
 *
 * A grant is what a {@link HostConnection} is made and renewed from — the
 * moment's news, not the standing state.
 */
export class HostGrant {
  private constructor(
    readonly accessToken: string,
    readonly refreshToken: string | null,
    readonly expiresAt: Date | null,
    readonly scopes: readonly string[],
    /** What the host calls the team, where it says so; null where it does not. */
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
