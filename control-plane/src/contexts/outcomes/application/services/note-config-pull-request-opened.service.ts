import type { DeletionsPort } from '@outcomes/application/ports/deletions.port';
import type {
  StationConfigPullRequest,
  StationConfigPullRequestsPort,
} from '@outcomes/application/ports/station-config-pull-requests.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class NoteConfigPullRequestOpened {
  constructor(
    private readonly pullRequests: StationConfigPullRequestsPort,
    private readonly deletions: DeletionsPort,
    private readonly transaction: TransactionPort,
  ) {}

  opened(pullRequest: StationConfigPullRequest): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const { workspaceId, teamId } = pullRequest;

      await this.deletions.lockDeletion(workspaceId, null, teamId);

      if (await this.deletions.isDeleted(workspaceId, null, teamId)) {
        return;
      }

      await this.pullRequests.note(pullRequest);
    });
  }
}
