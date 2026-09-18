import { ReviewCommentRemoved } from '@change-review/domain/events/review-comment-removed.event';
import { ReviewCommentReplied } from '@change-review/domain/events/review-comment-replied.event';
import { ReviewCommentRewritten } from '@change-review/domain/events/review-comment-rewritten.event';
import { InvalidReviewError } from '@change-review/domain/exceptions/invalid-review.error';
import { NotYourReviewCommentError } from '@change-review/domain/exceptions/not-your-review-comment.error';
import type { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import type { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import type { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import type { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import { EventRecorder } from '@shared-kernel/domain/aggregates/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const REVIEW_COMMENT_STATES = [
  'draft',
  'submitted',
  'posted',
  'failed',
  'deleted',
] as const;

export type ReviewCommentState = (typeof REVIEW_COMMENT_STATES)[number];

export const MOST_REVIEW_COMMENT = 65_000;

const MOST_EDITS_AWAITING_ECHO = 5;

export interface OnGitHub {
  readonly id: number;
  readonly url: string;
}

const written = (body: string): string => {
  const trimmed = body.trim();

  if (!trimmed) {
    throw new InvalidReviewError('comment says something');
  }
  if (trimmed.length > MOST_REVIEW_COMMENT) {
    throw new InvalidReviewError(
      `comment is at most ${MOST_REVIEW_COMMENT} characters`,
    );
  }

  return trimmed;
};

export class ReviewComment extends EventRecorder {
  private constructor(
    readonly id: ReviewCommentId,
    readonly workspaceId: WorkspaceId,
    readonly taskId: TaskId,
    readonly anchor: ReviewAnchor,
    readonly body: string,
    readonly author: ReviewAuthor,
    readonly replyTo: ReviewCommentId | null,
    readonly reviewId: ReviewId | null,
    readonly state: ReviewCommentState,
    readonly github: OnGitHub | null,
    readonly sentBody: string | null,
    readonly editPending: boolean,
    readonly editsAwaitingEcho: readonly string[],
    readonly createdAt: Date,
    readonly editedAt: Date | null,
    readonly version: number,
  ) {
    super();
  }

  static drafted(input: {
    id: ReviewCommentId;
    workspaceId: WorkspaceId;
    taskId: TaskId;
    anchor: ReviewAnchor;
    body: string;
    author: ReviewAuthor;
    now: Date;
  }): ReviewComment {
    if (!input.author.inSpotlight) {
      throw new InvalidReviewError(
        'comment is drafted by someone in Spotlight, or by an agent',
      );
    }

    return new ReviewComment(
      input.id,
      input.workspaceId,
      input.taskId,
      input.anchor,
      written(input.body),
      input.author,
      null,
      null,
      'draft',
      null,
      null,
      false,
      [],
      input.now,
      null,
      0,
    );
  }

  static arrived(input: {
    id: ReviewCommentId;
    workspaceId: WorkspaceId;
    taskId: TaskId;
    anchor: ReviewAnchor;
    body: string;
    author: ReviewAuthor;
    replyTo: ReviewCommentId | null;
    github: OnGitHub;
    at: Date;
  }): ReviewComment {
    if (input.author.inSpotlight) {
      throw new InvalidReviewError(
        'comment arrives from GitHub by someone on GitHub',
      );
    }

    return new ReviewComment(
      input.id,
      input.workspaceId,
      input.taskId,
      input.anchor,
      input.body.trim(),
      input.author,
      input.replyTo,
      null,
      'posted',
      input.github,
      null,
      false,
      [],
      input.at,
      null,
      0,
    );
  }

  static rehydrate(input: {
    id: ReviewCommentId;
    workspaceId: WorkspaceId;
    taskId: TaskId;
    anchor: ReviewAnchor;
    body: string;
    author: ReviewAuthor;
    replyTo: ReviewCommentId | null;
    reviewId: ReviewId | null;
    state: ReviewCommentState;
    github: OnGitHub | null;
    sentBody: string | null;
    editPending: boolean;
    editsAwaitingEcho: readonly string[];
    createdAt: Date;
    editedAt: Date | null;
    version: number;
  }): ReviewComment {
    if (input.state === 'draft' && input.github) {
      throw new InconsistentStateError(
        'review comment',
        'is a draft that is already on GitHub',
      );
    }
    if (input.state === 'draft' && input.reviewId) {
      throw new InconsistentStateError(
        'review comment',
        'is a draft that a review already holds',
      );
    }
    if (
      input.state !== 'deleted' &&
      (input.state === 'submitted') !== (input.sentBody !== null)
    ) {
      throw new InconsistentStateError(
        'review comment',
        'is on its way to GitHub without the body it sends, or sends one while not on its way',
      );
    }
    if (input.editPending && !input.github) {
      throw new InconsistentStateError(
        'review comment',
        'owes GitHub an edit without being on GitHub',
      );
    }

    return new ReviewComment(
      input.id,
      input.workspaceId,
      input.taskId,
      input.anchor,
      input.body,
      input.author,
      input.replyTo,
      input.reviewId,
      input.state,
      input.github,
      input.sentBody,
      input.editPending,
      input.editsAwaitingEcho,
      input.createdAt,
      input.editedAt,
      input.version,
    );
  }

  replied(input: {
    id: ReviewCommentId;
    body: string;
    author: ReviewAuthor;
    now: Date;
  }): ReviewComment {
    if (this.state === 'deleted') {
      throw new InvalidReviewError('reply is to a comment that is still there');
    }
    if (this.state === 'draft') {
      throw new InvalidReviewError(
        'reply is to a comment that has been submitted',
      );
    }
    if (input.author.kind !== 'person') {
      throw new InvalidReviewError('reply is written by someone in Spotlight');
    }

    const body = written(input.body);
    const reply = new ReviewComment(
      input.id,
      this.workspaceId,
      this.taskId,
      this.anchor,
      body,
      input.author,
      this.replyTo ?? this.id,
      null,
      'submitted',
      null,
      body,
      false,
      [],
      input.now,
      null,
      0,
    );

    reply.record(
      new ReviewCommentReplied(reply.id, reply.workspaceId, reply.taskId),
    );

    return reply;
  }

  visibleTo(viewer: UserId): boolean {
    if (this.state === 'deleted') {
      return false;
    }

    return this.state !== 'draft' || this.writtenBy(viewer);
  }

  writtenBy(viewer: UserId): boolean {
    return this.author.userId?.equals(viewer) ?? false;
  }

  get byAgent(): boolean {
    return this.author.kind === 'agent';
  }

  get sending(): boolean {
    return this.sentBody !== null;
  }

  echoes(anchor: ReviewAnchor, body: string): boolean {
    return (
      this.sentBody !== null &&
      this.anchor.equals(anchor) &&
      body.includes(this.sentBody)
    );
  }

  heldBy(reviewId: ReviewId): boolean {
    return this.reviewId?.equals(reviewId) ?? false;
  }

  submittedIn(reviewId: ReviewId): ReviewComment {
    if (this.state !== 'draft' || this.reviewId) {
      throw new InvalidReviewError('only submits comments still in draft');
    }

    return this.with({ state: 'submitted', reviewId, sentBody: this.body });
  }

  postedAs(github: OnGitHub | null): ReviewComment {
    if (this.sentBody === null) {
      return this;
    }

    const deleted = this.state === 'deleted';
    const rewritten =
      github !== null && !deleted && this.body !== this.sentBody;
    const posted = this.with({
      state: deleted ? 'deleted' : 'posted',
      github,
      sentBody: null,
      editPending: rewritten,
    });

    if (github && deleted) {
      posted.record(
        new ReviewCommentRemoved(this.id, this.workspaceId, this.taskId, true),
      );
    } else if (rewritten) {
      posted.record(
        new ReviewCommentRewritten(
          this.id,
          this.workspaceId,
          this.taskId,
          true,
        ),
      );
    }

    return posted;
  }

  rewritten(body: string, by: UserId, now: Date): ReviewComment {
    this.assertWrittenBy(by);

    if (this.state === 'deleted') {
      throw new InvalidReviewError('comment that was deleted cannot change');
    }

    const rewritten = this.with({
      body: written(body),
      editedAt: now,
      editPending: this.editPending || this.github !== null,
    });

    rewritten.record(
      new ReviewCommentRewritten(
        this.id,
        this.workspaceId,
        this.taskId,
        this.github !== null,
      ),
    );

    return rewritten;
  }

  removed(by: UserId): ReviewComment {
    this.assertWrittenBy(by);

    if (this.state === 'deleted') {
      return this;
    }

    const removed = this.with({ state: 'deleted' });

    removed.record(
      new ReviewCommentRemoved(
        this.id,
        this.workspaceId,
        this.taskId,
        this.github !== null,
      ),
    );

    return removed;
  }

  notPosted(): ReviewComment {
    if (this.sentBody === null) {
      return this;
    }
    if (this.state === 'deleted') {
      return this.with({ sentBody: null });
    }

    return this.reviewId
      ? this.with({ state: 'draft', reviewId: null, sentBody: null })
      : this.with({ state: 'failed', sentBody: null });
  }

  editSent(body: string): ReviewComment {
    return this.with({
      editPending: this.editPending && this.body !== body,
      editsAwaitingEcho: [
        ...this.editsAwaitingEcho.filter((each) => each !== body),
        body,
      ].slice(-MOST_EDITS_AWAITING_ECHO),
    });
  }

  editNotSent(): ReviewComment {
    return this.editPending ? this.with({ editPending: false }) : this;
  }

  editedOnGitHub(body: string, at: Date): ReviewComment {
    const edited = body.trim();

    if (this.state === 'deleted') {
      return this;
    }
    if (this.editsAwaitingEcho.includes(edited)) {
      return this.with({
        editsAwaitingEcho: this.editsAwaitingEcho.filter(
          (each) => each !== edited,
        ),
      });
    }

    return this.editPending || edited === this.body
      ? this
      : this.with({ body: edited, editedAt: at });
  }

  deletedOnGitHub(): ReviewComment {
    return this.with({ state: 'deleted' });
  }

  private assertWrittenBy(by: UserId): void {
    if (!this.writtenBy(by)) {
      throw new NotYourReviewCommentError();
    }
  }

  private with(change: {
    body?: string;
    state?: ReviewCommentState;
    reviewId?: ReviewId | null;
    github?: OnGitHub | null;
    sentBody?: string | null;
    editPending?: boolean;
    editsAwaitingEcho?: readonly string[];
    editedAt?: Date;
  }): ReviewComment {
    const next = new ReviewComment(
      this.id,
      this.workspaceId,
      this.taskId,
      this.anchor,
      change.body ?? this.body,
      this.author,
      this.replyTo,
      change.reviewId === undefined ? this.reviewId : change.reviewId,
      change.state ?? this.state,
      change.github === undefined ? this.github : change.github,
      change.sentBody === undefined ? this.sentBody : change.sentBody,
      change.editPending ?? this.editPending,
      change.editsAwaitingEcho ?? this.editsAwaitingEcho,
      this.createdAt,
      change.editedAt ?? this.editedAt,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
