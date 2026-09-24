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
        'is an absolute https URL, as in https://provision.example.com/runs',
      );
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new InvalidRunnerPoolError(
        'provision.url',
        'is an http or https URL, and https wherever tokens must not travel in the clear',
      );
    }

    if (url.username || url.password) {
      throw new InvalidRunnerPoolError(
        'provision.url',
        'carries no credentials; the call is signed with provision.secret instead',
      );
    }

    if (url.hash || given.length > MOST_LENGTH) {
      throw new InvalidRunnerPoolError(
        'provision.url',
        `is at most ${MOST_LENGTH} characters and has no fragment`,
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
