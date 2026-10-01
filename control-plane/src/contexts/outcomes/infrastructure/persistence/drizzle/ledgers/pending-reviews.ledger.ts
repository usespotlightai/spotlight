import { Injectable } from '@nestjs/common';
import type {
  PendingReview,
  PendingReviewsPort,
} from '@outcomes/application/ports/pending-reviews.port';
import { pendingReview } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, gte, lt } from 'drizzle-orm';

@Injectable()
export class DrizzlePendingReviews implements PendingReviewsPort {
  constructor(private readonly context: DrizzleContext) {}

  async hold(workspaceId: WorkspaceId, review: PendingReview): Promise<void> {
    await this.context.db
      .insert(pendingReview)
      .values({
        workspaceId: workspaceId.value,
        pullRequest: review.pullRequest.value,
        at: review.at,
      })
      .onConflictDoNothing();
  }

  async heldFor(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
    since: Date,
  ): Promise<readonly PendingReview[]> {
    const rows = await this.context.db
      .select()
      .from(pendingReview)
      .where(
        and(
          eq(pendingReview.workspaceId, workspaceId.value),
          eq(pendingReview.pullRequest, pullRequest.value),
          gte(pendingReview.at, since),
        ),
      )
      .orderBy(asc(pendingReview.at));

    return rows.map((row) => ({
      pullRequest: PullRequestUrl.of(row.pullRequest),
      at: row.at,
    }));
  }

  async release(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<void> {
    await this.context.db
      .delete(pendingReview)
      .where(
        and(
          eq(pendingReview.workspaceId, workspaceId.value),
          eq(pendingReview.pullRequest, pullRequest.value),
        ),
      );
  }

  async releaseBefore(workspaceId: WorkspaceId, before: Date): Promise<void> {
    await this.context.db
      .delete(pendingReview)
      .where(
        and(
          eq(pendingReview.workspaceId, workspaceId.value),
          lt(pendingReview.at, before),
        ),
      );
  }

  async releaseWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(pendingReview)
      .where(eq(pendingReview.workspaceId, workspaceId.value));
  }
}
