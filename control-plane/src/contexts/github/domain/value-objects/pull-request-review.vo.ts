import type { ReviewState } from '@github/domain/value-objects/review-state.vo';

export class PullRequestReview {
  private constructor(
    readonly id: number,
    readonly state: ReviewState,
    readonly login: string | null,
    readonly byBot: boolean,
    readonly at: Date | null,
  ) {}

  static of(input: {
    id: number;
    state: ReviewState;
    login: string | null;
    byBot: boolean;
    at: Date | null;
  }): PullRequestReview {
    return new PullRequestReview(
      input.id,
      input.state,
      input.login,
      input.byBot,
      input.at,
    );
  }

  equals(other: PullRequestReview): boolean {
    return (
      this.id === other.id &&
      this.state === other.state &&
      this.login === other.login &&
      this.byBot === other.byBot &&
      (this.at?.getTime() ?? null) === (other.at?.getTime() ?? null)
    );
  }
}
