import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isDottedName } from '@shared-kernel/domain/value-objects/identifier-shapes';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';

export const PULL_REQUEST_MARK_KIND = 'git.pull-request';

export const REVIEW_MARK_KIND = 'github.review';

export class Mark {
  private constructor(
    readonly kind: string,
    readonly value: string,
  ) {}

  static of(kind: string, value: string): Mark {
    const named = kind.trim();
    const trimmed = value.trim();

    if (!isDottedName(named)) {
      throw new InvalidIdentifierError(
        'mark',
        'must be a source and a name, as in git.pull-request',
      );
    }

    if (trimmed.length === 0) {
      throw new InvalidIdentifierError('mark', 'must not be empty');
    }

    return new Mark(named, trimmed);
  }

  static pullRequest(url: PullRequestUrl): Mark {
    return Mark.of(PULL_REQUEST_MARK_KIND, url.value);
  }

  static review(url: PullRequestUrl): Mark {
    return Mark.of(REVIEW_MARK_KIND, url.value);
  }

  equals(other: Mark): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return `${this.kind}:${this.value}`;
  }
}
