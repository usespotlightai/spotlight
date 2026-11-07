import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const isWebAddress = (raw: string): boolean => {
  try {
    const url = new URL(raw);

    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

export class OAuth2Endpoint {
  private readonly kind = 'oauth2-endpoint';

  private constructor(readonly value: string) {}

  static rehydrate(stored: string): OAuth2Endpoint {
    try {
      return OAuth2Endpoint.of(stored);
    } catch {
      throw new InconsistentStateError(
        'OAuth endpoint',
        'was stored in a shape it cannot take',
      );
    }
  }

  static of(raw: string): OAuth2Endpoint {
    if (!isWebAddress(raw)) {
      throw new InvalidIntegrationPartError(
        'oauth2 endpoint',
        `is a web address, not ${JSON.stringify(raw)}`,
      );
    }

    return new OAuth2Endpoint(raw);
  }

  equals(other: OAuth2Endpoint): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
