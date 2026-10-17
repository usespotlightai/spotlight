import { InvalidEgressError } from '@runners/domain/exceptions/invalid-egress.error';

const MOST_LENGTH = 2048;

export class EgressUrl {
  private readonly kind = 'egress-url';

  private constructor(readonly value: string) {}

  static of(raw: string): EgressUrl {
    const given = raw.trim();
    let url: URL;

    try {
      url = new URL(given);
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
        'must carry no credentials. Runners give their proxy credential',
      );
    }

    if (url.hash || url.search || given.length > MOST_LENGTH) {
      throw new InvalidEgressError(
        'url',
        `must be at most ${MOST_LENGTH} characters, with no query and no fragment`,
      );
    }

    return new EgressUrl(given);
  }

  get isSecure(): boolean {
    return new URL(this.value).protocol === 'https:';
  }

  equals(other: EgressUrl): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
