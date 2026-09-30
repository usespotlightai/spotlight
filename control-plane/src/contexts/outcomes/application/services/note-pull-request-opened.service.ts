import { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class NotePullRequestOpened {
  constructor(
    private readonly deliveries: TaskDeliveryRepository,
    private readonly transaction: TransactionPort,
  ) {}

  opened(
    taskId: TaskId,
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<void> {
    return this.transaction.run(async () => {
      const held = await this.deliveries.forTask(taskId);

      if (!held) {
        await this.deliveries.add(
          TaskDelivery.opened({ taskId, workspaceId, pullRequest }),
        );
        return;
      }

      const reopened = held.reopenedAs(pullRequest);

      if (reopened !== held) {
        await this.deliveries.save(reopened);
      }
    });
  }
}
