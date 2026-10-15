import { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';

const MOST_LENGTH = 2048;

export class ProvisionUrl {
  private readonly kind = 'provision-url';

  private constructor(readonly value: string) {}

  static of(raw: string): ProvisionUrl {
    const given = raw.trim();
    let url: URL;

    try {
      url = new URL(given);
    } catch {
      throw new InvalidRunnerPoolError(
        'provision.url',
        'must be an absolute https URL, as in https://provision.example.com/runs',
      );
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new InvalidRunnerPoolError(
        'provision.url',
        'must be an http or https URL',
      );
    }

    if (url.username || url.password) {
      throw new InvalidRunnerPoolError(
        'provision.url',
        'must carry no credentials. Calls are signed with provision.secret',
      );
    }

    if (url.hash || given.length > MOST_LENGTH) {
      throw new InvalidRunnerPoolError(
        'provision.url',
        `must be at most ${MOST_LENGTH} characters, with no fragment`,
      );
    }

    return new ProvisionUrl(given);
  }

  get hostname(): string {
    return new URL(this.value).hostname;
  }

  get isSecure(): boolean {
    return new URL(this.value).protocol === 'https:';
  }

  equals(other: ProvisionUrl): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
