import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

const SCOPE_TOKEN = /^[\x21\x23-\x5B\x5D-\x7E]+$/;

export class OAuthScope {
  private readonly kind = 'oauth-scope';

  private constructor(readonly value: string) {}

  static of(raw: string): OAuthScope {
    if (!SCOPE_TOKEN.test(raw)) {
      throw new InvalidIdentifierError(
        'oauth scope',
        'is one scope token, as in chat:write, with no spaces or quotes',
      );
    }

    return new OAuthScope(raw);
  }

  equals(other: OAuthScope): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
