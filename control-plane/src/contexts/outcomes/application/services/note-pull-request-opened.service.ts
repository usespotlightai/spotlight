import type { DeletionsPort } from '@outcomes/application/ports/deletions.port';
import type { PendingReviewsPort } from '@outcomes/application/ports/pending-reviews.port';
import { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import { longestLookbackFrom } from '@outcomes/domain/value-objects/insights-period.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PullRequestOpening {
  readonly taskId: TaskId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly pullRequest: PullRequestUrl;
  readonly at: Date;
}

export class NotePullRequestOpened {
  constructor(
    private readonly deliveries: TaskDeliveryRepository,
    private readonly reviews: PendingReviewsPort,
    private readonly deletions: DeletionsPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  opened(opening: PullRequestOpening): Promise<void> {
    return this.transaction.inTransaction(async () => {
      await this.deletions.lockDeletion(
        opening.workspaceId,
        opening.taskId,
        opening.teamId,
      );
      const existing = await this.deliveries.forTask(opening.taskId);

      if (
        !existing &&
        (await this.deletions.isDeleted(
          opening.workspaceId,
          opening.taskId,
          opening.teamId,
        ))
      ) {
        return;
      }

      const opened = existing
        ? existing.reopen(opening.pullRequest, opening.at)
        : TaskDelivery.open(opening);
      const pending = await this.reviews.pendingFor(
        opening.workspaceId,
        opening.pullRequest,
        longestLookbackFrom(this.clock.now()),
      );
      const reviewed = pending.reduce(
        (delivery, review) =>
          delivery.recordReview({ ...review, byBot: false }),
        opened,
      );

      if (!existing) {
        await this.deliveries.add(reviewed);
      } else if (reviewed !== existing) {
        await this.deliveries.save(reviewed);
      }

      await this.reviews.release(opening.workspaceId, opening.pullRequest);
    });
  }
}
