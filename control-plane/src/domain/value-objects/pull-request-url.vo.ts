import { InvalidPullRequestError } from '@domain/exceptions/invalid-pull-request.error';
import { Repository } from '@domain/value-objects/repository.vo';

export class PullRequestUrl {
  private constructor(readonly value: string) {}

  static of(raw: string): PullRequestUrl {
    const candidate = raw.trim();

    if (!candidate.startsWith('https://')) {
      throw new InvalidPullRequestError('is reached over https');
    }

    return new PullRequestUrl(candidate);
  }

  get repository(): Repository | null {
    let path: string;

    try {
      path = new URL(this.value).pathname;
    } catch {
      return null;
    }

    const [owner, name, kind, number] = path.replace(/^\/+/, '').split('/');

    if (!owner || !name || kind !== 'pull' || !/^\d+$/.test(number ?? '')) {
      return null;
    }

    try {
      return Repository.of(`${owner}/${name}`);
    } catch {
      return null;
    }
  }

  equals(other: PullRequestUrl): boolean {
    return this.value === other.value;
  }
}
