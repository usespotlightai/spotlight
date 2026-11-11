import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';

export class OwnedPullRequest {
  private constructor(
    readonly url: PullRequestUrl,
    readonly openedAt: Date,
    readonly closedAt: Date | null,
    readonly closeRouted: boolean,
  ) {}

  static of(
    url: PullRequestUrl,
    openedAt: Date,
    closedAt: Date | null = null,
    closeRouted = false,
  ): OwnedPullRequest {
    return new OwnedPullRequest(url, openedAt, closedAt, closeRouted);
  }

  get open(): boolean {
    return this.closedAt === null;
  }

  get settled(): boolean {
    return this.closedAt !== null || this.closeRouted;
  }

  reopened(): OwnedPullRequest {
    return this.closedAt || this.closeRouted
      ? new OwnedPullRequest(this.url, this.openedAt, null, false)
      : this;
  }

  closed(at: Date): OwnedPullRequest {
    return this.closedAt
      ? this
      : new OwnedPullRequest(this.url, this.openedAt, at, this.closeRouted);
  }

  routedClose(): OwnedPullRequest {
    return this.closeRouted
      ? this
      : new OwnedPullRequest(this.url, this.openedAt, this.closedAt, true);
  }
}
