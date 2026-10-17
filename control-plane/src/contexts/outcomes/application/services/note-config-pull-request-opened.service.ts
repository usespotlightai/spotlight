import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
import type {
  StationConfigPullRequest,
  StationConfigPullRequestsPort,
} from '@outcomes/application/ports/station-config-pull-requests.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class NoteConfigPullRequestOpened {
  constructor(
    private readonly pullRequests: StationConfigPullRequestsPort,
    private readonly forgotten: ForgottenPort,
    private readonly transaction: TransactionPort,
  ) {}

  opened(pullRequest: StationConfigPullRequest): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const { workspaceId, teamId } = pullRequest;

      await this.forgotten.holding(workspaceId, null, teamId);

      if (await this.forgotten.forgot(workspaceId, null, teamId)) {
        return;
      }

      await this.pullRequests.note(pullRequest);
    });
  }
}
