import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class OAuth2ClientId {
  private readonly kind = 'oauth2-client-id';

  private constructor(readonly value: string) {}

  static rehydrate(stored: string): OAuth2ClientId {
    try {
      return OAuth2ClientId.of(stored);
    } catch {
      throw new InconsistentStateError(
        'OAuth client id',
        'was stored in a shape it cannot take',
      );
    }
  }

  static of(raw: string): OAuth2ClientId {
    if (raw.trim().length === 0) {
      throw new InvalidIdentifierError(
        'oauth2 client id',
        'is what the authorization server named the client, and is never empty',
      );
    }

    return new OAuth2ClientId(raw);
  }

  static parsed(raw: string): OAuth2ClientId | null {
    return raw.trim().length === 0 ? null : new OAuth2ClientId(raw);
  }

  equals(other: OAuth2ClientId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
