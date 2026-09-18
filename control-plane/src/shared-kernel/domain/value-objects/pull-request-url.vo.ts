import { InvalidPullRequestError } from '@shared-kernel/domain/exceptions/invalid-pull-request.error';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

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

  get number(): number | null {
    let path: string;

    try {
      path = new URL(this.value).pathname;
    } catch {
      return null;
    }

    const [, , kind, number] = path.replace(/^\/+/, '').split('/');

    return kind === 'pull' && /^\d+$/.test(number ?? '')
      ? Number(number)
      : null;
  }

  get headRef(): string | null {
    return this.number === null ? null : `refs/pull/${this.number}/head`;
  }

  equals(other: PullRequestUrl): boolean {
    return this.value === other.value;
  }
}
