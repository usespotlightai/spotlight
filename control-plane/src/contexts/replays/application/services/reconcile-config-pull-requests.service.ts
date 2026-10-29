import type { ConfigRepositoryPort } from '@replays/application/ports/config-repository.port';
import type { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

const CHECK_EVERY_MS = 6 * 60 * 60_000;

const CHECKED_PER_TICK = 20;

export class ReconcileConfigPullRequests implements PendingJobsPort {
  readonly name = 'Reconciling config pull requests with GitHub';

  constructor(
    private readonly pullRequests: ConfigPullRequestRepository,
    private readonly configs: ConfigRepositoryPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async processDue(): Promise<void> {
    const now = this.clock.now();

    for (const pullRequest of await this.pullRequests.dueForCheck(
      new Date(now.getTime() - CHECK_EVERY_MS),
      CHECKED_PER_TICK,
    )) {
      await this.reconciled(pullRequest).catch((error: unknown) =>
        this.logger.warn(
          { err: error, pullRequestId: pullRequest.id.value },
          'A config pull request could not be reconciled with GitHub',
        ),
      );
    }
  }

  private async reconciled(due: ConfigPullRequest): Promise<void> {
    const at = due.gitHubPullRequest;

    if (!at) {
      return;
    }

    const status = await this.configs
      .statusOf(due.workspaceId, at)
      .catch(async (error: unknown) => {
        await this.settled(due, (current) => current.checked(this.clock.now()));
        throw error;
      });

    await this.settled(due, (current) =>
      status.state === 'open'
        ? current.checked(this.clock.now())
        : current.recordGitHubClose({
            merged: status.state === 'merged',
            at: status.closedAt ?? this.clock.now(),
          }),
    );
  }

  private settled(
    due: ConfigPullRequest,
    change: (current: ConfigPullRequest) => ConfigPullRequest,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const current = await this.pullRequests.find(due.id);

      if (current?.current === 'opened' && current.version === due.version) {
        await this.pullRequests.save(change(current));
      }
    });
  }
}
