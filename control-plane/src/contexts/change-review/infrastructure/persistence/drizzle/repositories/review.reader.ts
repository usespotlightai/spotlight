import type {
  ReviewCommentView,
  ReviewReaderPort,
  ReviewView,
} from '@change-review/application/ports/review-reader.port';
import {
  review,
  reviewComment,
} from '@change-review/infrastructure/persistence/drizzle/schemas/review.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { and, asc, eq, ne, or } from 'drizzle-orm';

@Injectable()
export class DrizzleReviewReader implements ReviewReaderPort {
  constructor(private readonly context: DrizzleContext) {}

  async commentsVisibleTo(
    taskId: TaskId,
    viewer: UserId,
  ): Promise<ReviewCommentView[]> {
    return this.context.db
      .select({
        id: reviewComment.id,
        path: reviewComment.path,
        side: reviewComment.side,
        line: reviewComment.line,
        startLine: reviewComment.startLine,
        body: reviewComment.body,
        authorId: reviewComment.authorId,
        authorLogin: reviewComment.authorLogin,
        authorName: reviewComment.authorName,
        replyTo: reviewComment.replyToId,
        reviewId: reviewComment.reviewId,
        state: reviewComment.state,
        url: reviewComment.githubUrl,
        createdAt: reviewComment.createdAt,
        editedAt: reviewComment.editedAt,
      })
      .from(reviewComment)
      .where(
        and(
          eq(reviewComment.taskId, taskId.value),
          ne(reviewComment.state, 'deleted'),
          or(
            ne(reviewComment.state, 'draft'),
            eq(reviewComment.authorId, viewer.value),
          ),
        ),
      )
      .orderBy(asc(reviewComment.createdAt));
  }

  async reviewsOf(taskId: TaskId): Promise<ReviewView[]> {
    return this.context.db
      .select({
        id: review.id,
        authorId: review.authorId,
        verdict: review.verdict,
        body: review.body,
        state: review.state,
        submittedAt: review.submittedAt,
      })
      .from(review)
      .where(
        and(eq(review.taskId, taskId.value), ne(review.state, 'withdrawn')),
      )
      .orderBy(asc(review.submittedAt));
  }
}
