import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';

export class OwnedPullRequest {
  private constructor(
    readonly url: PullRequestUrl,
    readonly openedAt: Date,
    readonly closedAt: Date | null,
    readonly closeRouted: boolean,
    readonly merged: boolean,
  ) {}

  static of(
    url: PullRequestUrl,
    openedAt: Date,
    closedAt: Date | null = null,
    closeRouted = false,
    merged = false,
  ): OwnedPullRequest {
    return new OwnedPullRequest(url, openedAt, closedAt, closeRouted, merged);
  }

  get open(): boolean {
    return this.closedAt === null;
  }

  get settled(): boolean {
    return this.closedAt !== null || this.closeRouted;
  }

  reopened(): OwnedPullRequest {
    return this.closedAt || this.closeRouted
      ? new OwnedPullRequest(this.url, this.openedAt, null, false, false)
      : this;
  }

  closed(at: Date, merged: boolean): OwnedPullRequest {
    return this.closedAt
      ? this
      : new OwnedPullRequest(
          this.url,
          this.openedAt,
          at,
          this.closeRouted,
          merged,
        );
  }

  routedClose(): OwnedPullRequest {
    return this.closeRouted
      ? this
      : new OwnedPullRequest(
          this.url,
          this.openedAt,
          this.closedAt,
          true,
          this.merged,
        );
  }
}
