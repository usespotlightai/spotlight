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

  /**
   * The repository the pull request lives in, read back from the URL: the
   * work landed there, so this is what a remark on it is answered against.
   * Null unless the URL is shaped like a pull request — `…/owner/name/pull/N`
   * — so an arbitrary https URL is not mistaken for one.
   */
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
