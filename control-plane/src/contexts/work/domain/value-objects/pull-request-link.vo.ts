import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export type PullRequestRelation = 'opened' | 'reviews';

export class PullRequestLink {
  private constructor(
    readonly url: PullRequestUrl,
    readonly relation: PullRequestRelation,
  ) {}

  static opened(url: PullRequestUrl): PullRequestLink {
    return new PullRequestLink(url, 'opened');
  }

  static reviewing(url: PullRequestUrl): PullRequestLink {
    return new PullRequestLink(url, 'reviews');
  }

  get reviews(): boolean {
    return this.relation === 'reviews';
  }

  get reviewed(): Repository | null {
    return this.reviews ? this.url.repository : null;
  }

  equals(other: PullRequestLink): boolean {
    return this.relation === other.relation && this.url.equals(other.url);
  }
}
