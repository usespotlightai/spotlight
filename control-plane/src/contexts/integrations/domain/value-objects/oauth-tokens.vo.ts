import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { OAuthScope } from '@integrations/domain/value-objects/oauth-scope.vo';
import { RefreshToken } from '@integrations/domain/value-objects/refresh-token.vo';
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
    readonly refreshToken: RefreshToken | null,
    readonly expiresAt: Date | null,
    readonly scopes: readonly OAuthScope[],
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
      RefreshToken.maybe(input.refreshToken),
      input.expiresAt ?? null,
      (input.scopes ?? []).map(OAuthScope.of),
      input.linkedAccount?.trim() || null,
    );
  }

  toJSON(): string {
    return '[oauth tokens]';
  }
}
