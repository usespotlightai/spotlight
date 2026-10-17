import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PullRequestClosing {
  readonly workspaceId: WorkspaceId;
  readonly pullRequest: PullRequestUrl;
  readonly merged: boolean;
  readonly at: Date | null;
}

export class NotePullRequestClosed {
  constructor(
    private readonly deliveries: TaskDeliveryRepository,
    private readonly transaction: TransactionPort,
  ) {}

  closed(closing: PullRequestClosing): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const held = await this.deliveries.forPullRequest(
        closing.workspaceId,
        closing.pullRequest,
      );

      if (!held) {
        return;
      }

      const closed = held.close(closing);

      if (closed !== held) {
        await this.deliveries.save(closed);
      }
    });
  }
}
