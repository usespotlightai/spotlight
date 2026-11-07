import type { PullRequestFactsPort } from '@insights/application/ports/pull-request-facts.port';
import type { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import type { PullRequestRecordRepository } from '@insights/domain/repositories/pull-request-record.repository';
import type { TaskChangeShapeRepository } from '@insights/domain/repositories/task-change-shape.repository';
import { pullRequestFactOf } from '@insights/domain/services/team-pull-requests';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ProjectPullRequestFacts {
  constructor(
    private readonly pullRequests: PullRequestRecordRepository,
    private readonly shapes: TaskChangeShapeRepository,
    private readonly facts: PullRequestFactsPort,
    private readonly transaction: TransactionPort,
  ) {}

  ofPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const record = await this.pullRequests.at(workspaceId, pullRequest);

      if (!record) {
        await this.facts.drop(workspaceId, pullRequest);
        return;
      }

      await this.project(record);
    });
  }

  ofTask(taskId: TaskId): Promise<void> {
    return this.transaction.inTransaction(async () => {
      for (const record of await this.pullRequests.ownedBy([taskId])) {
        await this.project(record);
      }
    });
  }

  private async project(record: PullRequestRecord): Promise<void> {
    const shape = record.owner
      ? await this.shapes.forTask(record.owner.taskId)
      : null;
    const fact = pullRequestFactOf(record, shape?.shape ?? null);

    await (fact
      ? this.facts.put(record.workspaceId, record.pullRequest, fact)
      : this.facts.drop(record.workspaceId, record.pullRequest));
  }
}
