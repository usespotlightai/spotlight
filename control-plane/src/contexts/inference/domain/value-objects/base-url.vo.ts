import { InvalidInferenceEndpointError } from '@inference/domain/exceptions/invalid-inference-endpoint.error';

const FIELD = 'baseUrl';

const EXAMPLE = 'such as https://openrouter.ai/api/v1';

const MOST = 2048;

export class BaseUrl {
  private constructor(readonly value: string) {}

  static of(raw: string): BaseUrl {
    const written = raw.trim().replace(/\/+$/, '');
    let url: URL;

    try {
      url = new URL(written);
    } catch {
      throw new InvalidInferenceEndpointError(
        FIELD,
        `must be a URL, ${EXAMPLE}`,
      );
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new InvalidInferenceEndpointError(
        FIELD,
        `must start with http:// or https://, ${EXAMPLE}`,
      );
    }

    if (url.username || url.password) {
      throw new InvalidInferenceEndpointError(
        FIELD,
        'must not hold a user name or a password. Use the API key',
      );
    }

    if (url.search || url.hash || written.length > MOST) {
      throw new InvalidInferenceEndpointError(
        FIELD,
        `must have no query or fragment, and at most ${MOST} characters`,
      );
    }

    return new BaseUrl(written);
  }

  equals(other: BaseUrl): boolean {
    return this.value === other.value;
  }
}
