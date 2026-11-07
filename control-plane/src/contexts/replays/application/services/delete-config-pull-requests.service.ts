import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DeleteConfigPullRequests {
  constructor(
    private readonly pullRequests: ConfigPullRequestRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async ofTeam(teamId: TeamId): Promise<void> {
    for (const pullRequest of await this.pullRequests.ofTeam(teamId)) {
      await this.transaction.inTransaction(() =>
        this.pullRequests.save(pullRequest.delete()),
      );
    }
  }
}
