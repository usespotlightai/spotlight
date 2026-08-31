import { InvalidPullRequestError } from '@domain/exceptions/invalid-pull-request.error';

export class PullRequestUrl {
  private constructor(readonly value: string) {}

  static of(raw: string): PullRequestUrl {
    const candidate = raw.trim();

    if (!candidate.startsWith('https://')) {
      throw new InvalidPullRequestError('is reached over https');
    }

    return new PullRequestUrl(candidate);
  }

  equals(other: PullRequestUrl): boolean {
    return this.value === other.value;
  }
}
