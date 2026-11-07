import { InvalidPullRequestTitleError } from '@work/domain/exceptions/invalid-pull-request-title.error';

const MAX_LENGTH = 256;

export class PullRequestTitle {
  private constructor(readonly value: string) {}

  static of(raw: string): PullRequestTitle {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidPullRequestTitleError('must not be empty');
    }

    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidPullRequestTitleError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new PullRequestTitle(trimmed);
  }

  equals(other: PullRequestTitle): boolean {
    return this.value === other.value;
  }
}
