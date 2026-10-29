import { ConfigRepositoryError } from '@replays/application/errors/config-repository.error';
import type { ConfigRepositoryPort } from '@replays/application/ports/config-repository.port';
import type {
  ConfigPullRequest,
  GitHubPullRequest,
} from '@replays/domain/aggregates/config-pull-request.aggregate';
import { ConfigPullRequestVersionConflictError } from '@replays/domain/exceptions/config-pull-request-version-conflict.error';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

const CLAIM_MS = 10 * 60_000;

export const STALE_COMMENT =
  "Spotlight closed this pull request. The station's live config changed after this pull request opened.";

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class CloseStaleConfigPullRequests implements PendingJobsPort {
  readonly name = 'Closing stale config pull requests';

  constructor(
    private readonly pullRequests: ConfigPullRequestRepository,
    private readonly configs: ConfigRepositoryPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async processDue(): Promise<void> {
    for (const pullRequest of await this.pullRequests.due(
      'closing',
      this.clock.now(),
    )) {
      await this.attempt(pullRequest).catch((error: unknown) =>
        this.logger.warn(
          { err: error, pullRequestId: pullRequest.id.value },
          'A stale config pull request could not be closed',
        ),
      );
    }
  }

  private async attempt(due: ConfigPullRequest): Promise<void> {
    const at = due.gitHubPullRequest;

    if (!at || !(await this.claimed(due))) {
      return;
    }

    try {
      await this.closedOnGitHub(due, at);
    } catch (error) {
      if (error instanceof ConfigRepositoryError) {
        await this.settled(due, (current) =>
          current.closeFailed(
            ConfigPullRequestReason.of({
              code: error.code,
              message: error.message,
            }),
            this.clock.now(),
          ),
        );
        return;
      }

      this.logger.warn(
        { err: error, pullRequestId: due.id.value },
        'Closing a stale config pull request failed. Spotlight tries again later.',
      );
      await this.settled(due, (current) =>
        current.closeTried(because(error), this.clock.now()),
      );
    }
  }

  private async closedOnGitHub(
    due: ConfigPullRequest,
    at: GitHubPullRequest,
  ): Promise<void> {
    const status = await this.configs.statusOf(due.workspaceId, at);

    if (status.state !== 'open') {
      await this.settled(due, (current) =>
        current.recordGitHubClose({
          merged: status.state === 'merged',
          at: status.closedAt ?? this.clock.now(),
        }),
      );
      return;
    }

    await this.configs.closed(due.workspaceId, at);
    await this.settled(due, (current) => current.closed(this.clock.now()));
    await this.configs
      .commented(due.workspaceId, at, STALE_COMMENT)
      .catch((error: unknown) =>
        this.logger.warn(
          { err: error, pullRequestId: due.id.value },
          'Spotlight closed a stale config pull request but could not comment on it',
        ),
      );
  }

  private async claimed(due: ConfigPullRequest): Promise<boolean> {
    try {
      await this.transaction.inTransaction(() =>
        this.pullRequests.save(
          due.claimed(new Date(this.clock.now().getTime() + CLAIM_MS)),
        ),
      );
      return true;
    } catch (error) {
      if (error instanceof ConfigPullRequestVersionConflictError) {
        return false;
      }
      throw error;
    }
  }

  private settled(
    due: ConfigPullRequest,
    change: (current: ConfigPullRequest) => ConfigPullRequest,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const current = await this.pullRequests.find(due.id);

      if (current?.current === 'closing') {
        await this.pullRequests.save(change(current));
      }
    });
  }
}
