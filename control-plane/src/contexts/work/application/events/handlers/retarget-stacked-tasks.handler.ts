import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class RetargetStackedTasks {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly pullRequests: Pick<PullRequestPort, 'retarget'>,
    private readonly transaction: TransactionPort,
  ) {}

  async merged(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
    repository: Repository,
  ): Promise<void> {
    const parent = await this.tasks.owningPullRequest(workspaceId, pullRequest);

    if (!parent) {
      return;
    }

    const into = parent.base;
    const settled = parent.ownedPullRequests.every(
      (each) => !each.open || each.url.equals(pullRequest),
    );

    for (const stacked of await this.tasks.startingFrom(
      workspaceId,
      parent.branch,
    )) {
      for (const each of stacked.openPullRequestsIn(repository)) {
        if (each.url.number !== null) {
          await this.pullRequests.retarget(
            { workspaceId, repository, number: each.url.number },
            into?.value ?? null,
          );
        }
      }

      if (settled) {
        await this.moved(stacked, parent);
      }
    }
  }

  private async moved(stacked: Task, parent: Task): Promise<void> {
    await this.transaction.inTransaction(async () => {
      const current = await this.tasks.find(stacked.id);
      const next = current?.baseMerged(parent.branch, parent.base);

      if (next && next !== current) {
        await this.tasks.save(next);
      }
    });
  }
}
