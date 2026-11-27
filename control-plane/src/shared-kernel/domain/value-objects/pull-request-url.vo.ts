import { InvalidPullRequestError } from '@shared-kernel/domain/exceptions/invalid-pull-request.error';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

const segmentsOf = (path: string): readonly (string | undefined)[] =>
  path.replace(/^\/+/, '').split('/');

export class PullRequestUrl {
  private constructor(readonly value: string) {}

  static of(raw: string): PullRequestUrl {
    const candidate = raw.trim();

    if (!candidate.startsWith('https://')) {
      throw new InvalidPullRequestError('must use https');
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

    const [owner, name, kind, number] = segmentsOf(path);

    if (
      !nonEmpty(owner) ||
      !nonEmpty(name) ||
      kind !== 'pull' ||
      !/^\d+$/.test(number ?? '')
    ) {
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

    const [, , kind, number] = segmentsOf(path);

    return kind === 'pull' && /^\d+$/.test(number ?? '')
      ? Number(number)
      : null;
  }

  get headRef(): string | null {
    return this.number === null ? null : `refs/pull/${this.number}/head`;
  }

  equals(other: PullRequestUrl): boolean {
    if (this.value === other.value) {
      return true;
    }

    const repository = this.repository;
    const theirs = other.repository;

    return (
      repository !== null &&
      theirs !== null &&
      repository.equals(theirs) &&
      this.number !== null &&
      this.number === other.number
    );
  }
}
