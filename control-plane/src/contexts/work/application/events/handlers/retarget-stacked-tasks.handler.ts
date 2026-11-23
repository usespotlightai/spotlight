import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { stackedTaskMoves } from '@work/domain/services/stacked-task-moves';

const SAVE_ATTEMPTS = 3;

export class RetargetStackedTasks {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly pullRequests: Pick<PullRequestPort, 'retarget'>,
    private readonly transaction: TransactionPort,
  ) {}

  async closed(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
    repository: Repository,
    merged: boolean,
  ): Promise<void> {
    const parent = await this.tasks.owningPullRequest(workspaceId, pullRequest);

    if (!parent) {
      return;
    }

    const moves = stackedTaskMoves(
      parent,
      { url: pullRequest, merged },
      await this.tasks.startingFrom(workspaceId, parent.branch),
    );
    const failed = new Set<string>();
    const errors: unknown[] = [];

    for (const each of moves.retargets) {
      await this.pullRequests
        .retarget(
          { workspaceId, repository, number: each.number },
          moves.into?.value ?? null,
        )
        .catch((error: unknown) => {
          failed.add(each.task.id.value);
          errors.push(error);
        });
    }

    for (const stacked of moves.moved) {
      if (!failed.has(stacked.id.value)) {
        await this.moved(stacked, parent).catch((error: unknown) => {
          errors.push(error);
        });
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        `Could not move ${errors.length} pull requests or tasks stacked on ${parent.branch.value}`,
      );
    }
  }

  private async moved(stacked: Task, parent: Task): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await this.transaction.inTransaction(async () => {
          const current = await this.tasks.find(stacked.id);
          const next = current?.baseMerged(parent.branch, parent.base);

          if (next && next !== current) {
            await this.tasks.save(next);
          }
        });

        return;
      } catch (error) {
        if (
          !(error instanceof TaskVersionConflictError) ||
          attempt >= SAVE_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
