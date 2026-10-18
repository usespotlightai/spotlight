import type { TaskPullRequestRepository } from '@insights/domain/repositories/task-pull-request.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PullRequestClosing {
  readonly workspaceId: WorkspaceId;
  readonly pullRequest: PullRequestUrl;
  readonly merged: boolean;
  readonly at: Date | null;
}

export class RecordPullRequestClosing {
  constructor(
    private readonly taskPullRequests: TaskPullRequestRepository,
    private readonly transaction: TransactionPort,
  ) {}

  closed(closing: PullRequestClosing): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const existing = await this.taskPullRequests.forPullRequest(
        closing.workspaceId,
        closing.pullRequest,
      );

      if (!existing) {
        return;
      }

      const closed = existing.close(closing);

      if (closed !== existing) {
        await this.taskPullRequests.save(closed);
      }
    });
  }
}
