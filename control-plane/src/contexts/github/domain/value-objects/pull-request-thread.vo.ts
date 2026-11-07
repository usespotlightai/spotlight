export class PullRequestThread {
  private constructor(
    readonly id: string,
    readonly firstCommentId: number | null,
    readonly login: string | null,
    readonly byBot: boolean,
    readonly resolved: boolean,
  ) {}

  static of(input: {
    id: string;
    firstCommentId: number | null;
    login: string | null;
    byBot: boolean;
    resolved: boolean;
  }): PullRequestThread {
    return new PullRequestThread(
      input.id,
      input.firstCommentId,
      input.login,
      input.byBot,
      input.resolved,
    );
  }

  equals(other: PullRequestThread): boolean {
    return (
      this.id === other.id &&
      this.firstCommentId === other.firstCommentId &&
      this.login === other.login &&
      this.byBot === other.byBot &&
      this.resolved === other.resolved
    );
  }
}
