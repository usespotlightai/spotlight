import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

const SCOPE_TOKEN = /^[\x21\x23-\x5B\x5D-\x7E]+$/;

export class OAuthScope {
  private readonly kind = 'oauth-scope';

  private constructor(readonly value: string) {}

  static rehydrate(stored: string): OAuthScope {
    try {
      return OAuthScope.of(stored);
    } catch {
      throw new InconsistentStateError(
        'OAuth scope',
        'was stored in a shape it cannot take',
      );
    }
  }

  static readonly SHAPE =
    'is one scope token, as in chat:write, with no spaces or quotes';

  static isToken(raw: string): boolean {
    return SCOPE_TOKEN.test(raw);
  }

  static of(raw: string): OAuthScope {
    if (!OAuthScope.isToken(raw)) {
      throw new InvalidIdentifierError('oauth scope', OAuthScope.SHAPE);
    }

    return new OAuthScope(raw);
  }

  equals(other: OAuthScope): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
