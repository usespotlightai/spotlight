import type {
  OnGitHub,
  ReviewComment,
} from '@change-review/domain/aggregates/review-comment.aggregate';
import { IncludedCommentPosted } from '@change-review/domain/events/included-comment-posted.event';
import { IncludedCommentReturned } from '@change-review/domain/events/included-comment-returned.event';
import { ReviewPosted } from '@change-review/domain/events/review-posted.event';
import { ReviewSubmitted } from '@change-review/domain/events/review-submitted.event';
import { InvalidReviewError } from '@change-review/domain/exceptions/invalid-review.error';
import type { DeliveryFailure } from '@change-review/domain/value-objects/delivery-failure.vo';
import type { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import type { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import type { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ReviewPostingPlan {
  readonly onLines: readonly ReviewComment[];
  readonly onFiles: readonly ReviewComment[];
  readonly deleted: readonly ReviewComment[];
  readonly empty: boolean;
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
  'discarded',
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
    readonly verdictOnGitHub: ReviewVerdict | null,
    readonly submittedAt: Date,
    readonly postedAt: Date | null,
    readonly failure: DeliveryFailure | null,
    readonly version: number,
  ) {
    super();
  }

  static takesOnGitHub(
    verdict: ReviewVerdict,
    onGitHub: ReviewVerdict,
  ): boolean {
    return onGitHub === verdict || onGitHub === 'comment';
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

    const drafts = input.drafts.filter(
      (draft) =>
        draft.state === 'draft' &&
        draft.reviewId === null &&
        input.author.isSameAs(draft.author) &&
        draft.taskId.equals(input.taskId),
    );

    if (!hasContent(verdict, body, drafts.length)) {
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
      drafts.map((draft) => draft.id),
      'submitted',
      null,
      null,
      input.now,
      null,
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
      claimed: drafts.map((draft) => draft.submittedIn(review.id)),
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
    verdictOnGitHub: ReviewVerdict | null;
    submittedAt: Date;
    postedAt: Date | null;
    failure: DeliveryFailure | null;
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
    if (
      (input.state === 'posted') !== (input.verdictOnGitHub !== null) ||
      (input.verdictOnGitHub !== null &&
        !Review.takesOnGitHub(input.verdict, input.verdictOnGitHub))
    ) {
      throw new InconsistentStateError(
        'review',
        'is posted without the verdict GitHub took, or GitHub took a verdict it cannot take',
      );
    }
    if ((input.state === 'failed') !== (input.failure !== null)) {
      throw new InconsistentStateError(
        'review',
        'failed to reach GitHub without a reason, or has a reason while it did not fail',
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
      input.verdictOnGitHub,
      input.submittedAt,
      input.postedAt,
      input.failure,
      input.version,
    );
  }

  postingPlan(comments: readonly (ReviewComment | null)[]): ReviewPostingPlan {
    const own = comments.flatMap((comment) =>
      comment?.sending && comment.belongsTo(this.id) ? [comment] : [],
    );
    const sent = own.filter((comment) => comment.state === 'sending');

    return {
      onLines: sent.filter((comment) => !comment.anchor.wholeFile),
      onFiles: sent.filter((comment) => comment.anchor.wholeFile),
      deleted: own.filter((comment) => comment.state === 'deleted'),
      empty: !hasContent(this.verdict, this.body, sent.length),
    };
  }

  get postedAsComment(): boolean {
    return this.verdictOnGitHub === 'comment' && this.verdict !== 'comment';
  }

  postedAs(input: {
    githubId: number;
    verdictOnGitHub: ReviewVerdict;
    comments: readonly (ReviewComment | null)[];
    onLinesOnGitHub: readonly (OnGitHub | null)[];
    now: Date;
  }): Review {
    if (this.state !== 'submitted') {
      throw new InvalidReviewError('is already posted to GitHub');
    }

    if (!Review.takesOnGitHub(this.verdict, input.verdictOnGitHub)) {
      throw new InvalidReviewError(
        `was posted to GitHub as ${input.verdictOnGitHub}, which is neither its verdict nor a comment`,
      );
    }

    const plan = this.postingPlan(input.comments);
    const posted = this.with('posted', input.githubId, input.now, null, {
      verdictOnGitHub: input.verdictOnGitHub,
    });

    posted.record(
      new ReviewPosted(
        this.id,
        this.workspaceId,
        this.taskId,
        plan.onFiles.map((comment) => comment.id),
      ),
    );
    plan.onLines.forEach((comment, position) => {
      posted.record(
        new IncludedCommentPosted(
          this.id,
          comment.id,
          input.onLinesOnGitHub[position] ?? null,
        ),
      );
    });
    for (const comment of plan.deleted) {
      posted.record(new IncludedCommentPosted(this.id, comment.id, null));
    }

    return posted;
  }

  discard(comments: readonly (ReviewComment | null)[]): Review {
    if (this.state !== 'submitted') {
      throw new InvalidReviewError('cannot be discarded after it is posted');
    }
    if (!this.postingPlan(comments).empty) {
      throw new InvalidReviewError('can only be discarded when it is empty');
    }

    const discarded = this.with('discarded', null, null, null);

    discarded.returnCommentsToDraft();

    return discarded;
  }

  failedToPost(failure: DeliveryFailure): Review {
    if (this.state !== 'submitted') {
      return this;
    }

    const failed = this.with('failed', null, null, failure);

    failed.returnCommentsToDraft();

    return failed;
  }

  private returnCommentsToDraft(): void {
    for (const commentId of this.comments) {
      this.record(new IncludedCommentReturned(this.id, commentId));
    }
  }

  private with(
    state: ReviewState,
    githubId: number | null,
    postedAt: Date | null,
    failure: DeliveryFailure | null,
    onGitHub: { verdictOnGitHub: ReviewVerdict | null } = {
      verdictOnGitHub: null,
    },
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
      onGitHub.verdictOnGitHub,
      this.submittedAt,
      postedAt,
      failure,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
