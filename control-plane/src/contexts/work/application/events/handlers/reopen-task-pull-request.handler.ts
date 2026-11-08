import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { correlatedTask } from '@work/application/services/correlated-task';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';

export class ReopenTaskPullRequest {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async on(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<void> {
    const keys = CorrelationKeys.of({ marks: [Mark.pullRequest(pullRequest)] });

    if (!keys) {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const task = await correlatedTask(this.tasks, workspaceId, keys);

      if (!task) {
        return;
      }

      const reopened = task.pullRequestReopened(pullRequest);

      if (reopened !== task) {
        await this.tasks.save(reopened);
      }
    });
  }
}
