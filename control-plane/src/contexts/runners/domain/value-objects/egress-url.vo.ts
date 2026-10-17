import { InvalidEgressError } from '@runners/domain/exceptions/invalid-egress.error';

const MAX_LENGTH = 2048;

export class EgressUrl {
  private readonly kind = 'egress-url';

  private constructor(readonly value: string) {}

  static of(raw: string): EgressUrl {
    const trimmed = raw.trim();
    let url: URL;

    try {
      url = new URL(trimmed);
    } catch {
      throw new InvalidEgressError(
        'url',
        'must be an absolute http or https URL, as in https://egress.example.com',
      );
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new InvalidEgressError('url', 'must be an http or https URL');
    }

    if (url.username || url.password) {
      throw new InvalidEgressError(
        'url',
        'must carry no credentials. Runners send their proxy credential',
      );
    }

    if (url.hash || url.search || trimmed.length > MAX_LENGTH) {
      throw new InvalidEgressError(
        'url',
        `must be at most ${MAX_LENGTH} characters, with no query and no fragment`,
      );
    }

    return new EgressUrl(trimmed);
  }

  get isSecure(): boolean {
    return new URL(this.value).protocol === 'https:';
  }

  equals(other: EgressUrl): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
