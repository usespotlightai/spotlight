import type {
  OnGitHub,
  ReviewComment,
} from '@change-review/domain/aggregates/review-comment.aggregate';
import { ReviewCommentNotPosted } from '@change-review/domain/events/review-comment-not-posted.event';
import { ReviewCommentPlaced } from '@change-review/domain/events/review-comment-placed.event';
import { ReviewPosted } from '@change-review/domain/events/review-posted.event';
import { ReviewSubmitted } from '@change-review/domain/events/review-submitted.event';
import { InvalidReviewError } from '@change-review/domain/exceptions/invalid-review.error';
import type { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import type { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import type { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PlacedComment {
  readonly commentId: ReviewCommentId;
  readonly github: OnGitHub | null;
}

export const REVIEW_VERDICTS = [
  'comment',
  'approve',
  'request-changes',
] as const;

export type ReviewVerdict = (typeof REVIEW_VERDICTS)[number];

export const REVIEW_STATES = [
  'submitted',
  'posted',
  'failed',
  'withdrawn',
] as const;

export type ReviewState = (typeof REVIEW_STATES)[number];

const hasContent = (verdict: ReviewVerdict, body: string, comments: number) =>
  verdict === 'approve' || body.length > 0 || comments > 0;

export interface SubmittedReview {
  readonly review: Review;
  readonly claimed: readonly ReviewComment[];
}

export class Review extends EventRecorder {
  private constructor(
    readonly id: ReviewId,
    readonly workspaceId: WorkspaceId,
    readonly taskId: TaskId,
    readonly author: ReviewAuthor,
    readonly verdict: ReviewVerdict,
    readonly body: string,
    readonly comments: readonly ReviewCommentId[],
    readonly state: ReviewState,
    readonly githubId: number | null,
    readonly submittedAt: Date,
    readonly postedAt: Date | null,
    readonly version: number,
  ) {
    super();
  }

  static submit(input: {
    id: ReviewId;
    workspaceId: WorkspaceId;
    taskId: TaskId;
    author: ReviewAuthor;
    verdict: string;
    body: string;
    drafts: readonly ReviewComment[];
    now: Date;
  }): SubmittedReview {
    if (!input.author.inSpotlight) {
      throw new InvalidReviewError('must be submitted by a person or an agent');
    }

    if (!(REVIEW_VERDICTS as readonly string[]).includes(input.verdict)) {
      throw new InvalidReviewError(
        'verdict must be comment, approve or request changes',
      );
    }

    const verdict = input.verdict as ReviewVerdict;
    const body = input.body.trim();

    for (const draft of input.drafts) {
      if (
        draft.state !== 'draft' ||
        draft.reviewId !== null ||
        !input.author.isSameAs(draft.author) ||
        !draft.taskId.equals(input.taskId)
      ) {
        throw new InvalidReviewError(
          'can only include its author’s drafts on this task',
        );
      }
    }

    if (!hasContent(verdict, body, input.drafts.length)) {
      throw new InvalidReviewError(
        verdict === 'request-changes'
          ? 'that requests changes must say which'
          : 'must say something',
      );
    }

    const review = new Review(
      input.id,
      input.workspaceId,
      input.taskId,
      input.author,
      verdict,
      body,
      input.drafts.map((draft) => draft.id),
      'submitted',
      null,
      input.now,
      null,
      0,
    );

    review.record(
      new ReviewSubmitted(
        review.id,
        review.workspaceId,
        review.taskId,
        review.comments,
      ),
    );

    return {
      review,
      claimed: input.drafts.map((draft) => draft.submittedIn(review.id)),
    };
  }

  static rehydrate(input: {
    id: ReviewId;
    workspaceId: WorkspaceId;
    taskId: TaskId;
    author: ReviewAuthor;
    verdict: ReviewVerdict;
    body: string;
    comments: readonly ReviewCommentId[];
    state: ReviewState;
    githubId: number | null;
    submittedAt: Date;
    postedAt: Date | null;
    version: number;
  }): Review {
    if (!input.author.inSpotlight) {
      throw new InconsistentStateError(
        'review',
        'was submitted by nobody in Spotlight',
      );
    }

    if ((input.state === 'posted') !== (input.githubId !== null)) {
      throw new InconsistentStateError(
        'review',
        'is posted without a number on GitHub, or numbered without being posted',
      );
    }

    return new Review(
      input.id,
      input.workspaceId,
      input.taskId,
      input.author,
      input.verdict,
      input.body,
      input.comments,
      input.state,
      input.githubId,
      input.submittedAt,
      input.postedAt,
      input.version,
    );
  }

  silentWith(posted: readonly ReviewComment[]): boolean {
    return !hasContent(
      this.verdict,
      this.body,
      posted.filter((comment) => comment.belongsTo(this.id)).length,
    );
  }

  postedAs(
    githubId: number,
    now: Date,
    placed: readonly PlacedComment[] = [],
    onFiles: readonly ReviewCommentId[] = [],
  ): Review {
    if (this.state !== 'submitted') {
      throw new InvalidReviewError('is already posted to GitHub');
    }

    const posted = this.with('posted', githubId, now);

    posted.record(
      new ReviewPosted(this.id, this.workspaceId, this.taskId, onFiles),
    );
    for (const each of placed) {
      posted.record(
        new ReviewCommentPlaced(this.id, each.commentId, each.github),
      );
    }

    return posted;
  }

  withdraw(posted: readonly ReviewComment[]): Review {
    if (this.state !== 'submitted') {
      throw new InvalidReviewError('cannot be withdrawn after it is posted');
    }
    if (!this.silentWith(posted)) {
      throw new InvalidReviewError('can only be withdrawn once it is empty');
    }

    const withdrawn = this.with('withdrawn', null, null);

    withdrawn.handingBackComments();

    return withdrawn;
  }

  failedToPost(): Review {
    if (this.state !== 'submitted') {
      return this;
    }

    const failed = this.with('failed', null, null);

    failed.handingBackComments();

    return failed;
  }

  private handingBackComments(): void {
    for (const commentId of this.comments) {
      this.record(new ReviewCommentNotPosted(this.id, commentId));
    }
  }

  private with(
    state: ReviewState,
    githubId: number | null,
    postedAt: Date | null,
  ): Review {
    const next = new Review(
      this.id,
      this.workspaceId,
      this.taskId,
      this.author,
      this.verdict,
      this.body,
      this.comments,
      state,
      githubId,
      this.submittedAt,
      postedAt,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
