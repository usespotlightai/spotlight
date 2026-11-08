import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';

export class LaterPullRequest {
  private constructor(
    readonly url: PullRequestUrl,
    readonly openedAt: Date,
    readonly closedAt: Date | null,
  ) {}

  static of(
    url: PullRequestUrl,
    openedAt: Date,
    closedAt: Date | null = null,
  ): LaterPullRequest {
    return new LaterPullRequest(url, openedAt, closedAt);
  }

  reopened(): LaterPullRequest {
    return this.closedAt
      ? new LaterPullRequest(this.url, this.openedAt, null)
      : this;
  }

  closed(at: Date): LaterPullRequest {
    return this.closedAt
      ? this
      : new LaterPullRequest(this.url, this.openedAt, at);
  }
}
