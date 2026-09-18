import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

export class HostGrant implements Secret {
  get [SECRET](): true {
    return true;
  }

  private constructor(
    readonly accessToken: AccessToken,
    readonly refreshToken: AccessToken | null,
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
    return new HostGrant(
      AccessToken.of(input.accessToken),
      AccessToken.maybe(input.refreshToken),
      input.expiresAt ?? null,
      input.scopes ?? [],
      input.handle?.trim() || null,
    );
  }

  toJSON(): string {
    return '[host grant]';
  }
}
