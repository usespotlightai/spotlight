import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

export class OAuthTokens implements Secret {
  get [SECRET](): true {
    return true;
  }

  private constructor(
    readonly accessToken: AccessToken,
    readonly refreshToken: AccessToken | null,
    readonly expiresAt: Date | null,
    readonly scopes: readonly string[],
    readonly linkedAccount: string | null,
  ) {}

  static of(input: {
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: Date | null;
    scopes?: readonly string[];
    linkedAccount?: string | null;
  }): OAuthTokens {
    return new OAuthTokens(
      AccessToken.of(input.accessToken),
      AccessToken.maybe(input.refreshToken),
      input.expiresAt ?? null,
      input.scopes ?? [],
      input.linkedAccount?.trim() || null,
    );
  }

  toJSON(): string {
    return '[oauth tokens]';
  }
}
