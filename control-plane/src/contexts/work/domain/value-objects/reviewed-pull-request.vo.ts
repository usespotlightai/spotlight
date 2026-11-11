import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export interface ReviewedHead {
  readonly repository: Repository;
  readonly ref: string;
}

export class ReviewedPullRequest {
  private constructor(
    readonly url: PullRequestUrl,
    readonly fromOutside: boolean,
  ) {}

  static of(
    url: PullRequestUrl,
    by: { outside: boolean },
  ): ReviewedPullRequest {
    return new ReviewedPullRequest(url, by.outside);
  }

  get reviewedHead(): ReviewedHead | null {
    const repository = this.url.repository;
    const ref = this.url.headRef;

    return repository && ref ? { repository, ref } : null;
  }

  equals(other: ReviewedPullRequest): boolean {
    return this.fromOutside === other.fromOutside && this.url.equals(other.url);
  }
}
