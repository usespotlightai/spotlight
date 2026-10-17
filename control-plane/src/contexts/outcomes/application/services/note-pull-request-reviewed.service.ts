import type { DeletionsPort } from '@outcomes/application/ports/deletions.port';
import type { PendingReviewsPort } from '@outcomes/application/ports/pending-reviews.port';
import { countsAsReview } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import { longestLookbackFrom } from '@outcomes/domain/value-objects/insights-period.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PullRequestReviewing {
  readonly workspaceId: WorkspaceId;
  readonly pullRequest: PullRequestUrl;
  readonly byBot: boolean;
  readonly at: Date | null;
}

export class NotePullRequestReviewed {
  constructor(
    private readonly deliveries: TaskDeliveryRepository,
    private readonly reviews: PendingReviewsPort,
    private readonly deletions: DeletionsPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  reviewed(review: PullRequestReviewing): Promise<void> {
    if (!countsAsReview(review)) {
      return Promise.resolve();
    }

    return this.transaction.inTransaction(async () => {
      await this.deletions.lockDeletion(review.workspaceId, null);
      const existing = await this.deliveries.forPullRequest(
        review.workspaceId,
        review.pullRequest,
      );

      if (!existing) {
        const retainedFrom = longestLookbackFrom(this.clock.now());

        if (
          review.at.getTime() >= retainedFrom.getTime() &&
          !(await this.deletions.isDeleted(review.workspaceId, null))
        ) {
          await this.reviews.add(review.workspaceId, {
            pullRequest: review.pullRequest,
            at: review.at,
          });
        }

        await this.reviews.releaseBefore(review.workspaceId, retainedFrom);
        return;
      }

      const reviewed = existing.recordReview(review);

      if (reviewed !== existing) {
        await this.deliveries.save(reviewed);
      }
    });
  }
}
