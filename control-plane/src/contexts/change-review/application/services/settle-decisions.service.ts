import type { WorkPort } from '@change-review/application/ports/work.port';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import { DecisionMerge } from '@change-review/domain/value-objects/decision-merge.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ClosedPullRequest {
  readonly workspaceId: WorkspaceId;
  readonly pullRequest: PullRequestUrl;
  readonly repository: Repository;
  readonly merge: { readonly commit: string } | null;
  readonly closedAt: Date | null;
}

export class SettleDecisions {
  constructor(
    private readonly work: WorkPort,
    private readonly sets: DecisionSetRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async closed(closed: ClosedPullRequest): Promise<void> {
    const task = await this.work.taskWithPullRequest(
      closed.workspaceId,
      closed.pullRequest,
    );

    if (!task || task.reviewing) {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const set = await this.sets.forTask(task.id);

      if (!set) {
        return;
      }

      await this.sets.save(
        closed.merge
          ? set.merge(
              DecisionMerge.of({
                repository: closed.repository,
                commit: closed.merge.commit,
                at: closed.closedAt ?? this.clock.now(),
              }),
            )
          : set.closeUnmerged(),
      );
    });
  }
}
