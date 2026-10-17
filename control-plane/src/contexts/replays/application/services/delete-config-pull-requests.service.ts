import { ConfigPullRequestDeletionRequested } from '@replays/domain/events/config-pull-request-deletion-requested.event';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DeleteConfigPullRequests {
  constructor(
    private readonly pullRequests: ConfigPullRequestRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async deleteForTeam(
    teamId: TeamId,
    workspaceId: WorkspaceId,
  ): Promise<readonly DomainEvent[]> {
    return (await this.pullRequests.ofTeam(teamId)).map(
      (each) => new ConfigPullRequestDeletionRequested(each.id, workspaceId),
    );
  }

  pullRequest(id: ConfigPullRequestId): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const found = await this.pullRequests.find(id);

      if (found) {
        await this.pullRequests.save(found.delete());
      }
    });
  }
}
