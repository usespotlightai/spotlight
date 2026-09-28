import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export type PullRequestRelation = 'opened' | 'reviews';

export interface ReviewedHead {
  readonly repository: Repository;
  readonly ref: string;
}

export class PullRequestLink {
  private constructor(
    readonly url: PullRequestUrl,
    readonly relation: PullRequestRelation,
    readonly fromOutside: boolean,
  ) {}

  static opened(url: PullRequestUrl): PullRequestLink {
    return new PullRequestLink(url, 'opened', false);
  }

  static reviewing(
    url: PullRequestUrl,
    by: { outside: boolean },
  ): PullRequestLink {
    return new PullRequestLink(url, 'reviews', by.outside);
  }

  get reviews(): boolean {
    return this.relation === 'reviews';
  }

  get reviewedHead(): ReviewedHead | null {
    const repository = this.reviews ? this.url.repository : null;
    const ref = this.url.headRef;

    return repository && ref ? { repository, ref } : null;
  }

  equals(other: PullRequestLink): boolean {
    return (
      this.relation === other.relation &&
      this.fromOutside === other.fromOutside &&
      this.url.equals(other.url)
    );
  }
}
