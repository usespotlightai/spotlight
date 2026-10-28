import type { WorkPort } from '@replays/application/ports/work.port';
import type { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type {
  ConfigPullRequestRepository,
  GitHubPullRequestKey,
} from '@replays/domain/repositories/config-pull-request.repository';
import type { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface GitHubPullRequestEvent {
  readonly workspaceId: WorkspaceId;
  readonly repository: Repository;
  readonly pullRequest: PullRequestUrl;
  readonly gitHubId: number | null;
  readonly at: Date | null;
}

export interface ClosedPullRequest extends GitHubPullRequestEvent {
  readonly merged: boolean;
}

const keyOf = (event: GitHubPullRequestEvent): GitHubPullRequestKey | null =>
  event.pullRequest.number === null
    ? null
    : {
        gitHubId: event.gitHubId,
        repository: event.repository.value,
        number: event.pullRequest.number,
      };

export class FollowConfigPullRequests {
  constructor(
    private readonly pullRequests: ConfigPullRequestRepository,
    private readonly work: WorkPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  closedOnGitHub(closed: ClosedPullRequest): Promise<void> {
    return this.changed(closed, (pullRequest) =>
      pullRequest.recordGitHubClose({
        merged: closed.merged,
        at: closed.at ?? this.clock.now(),
      }),
    );
  }

  reopenedOnGitHub(reopened: GitHubPullRequestEvent): Promise<void> {
    return this.changed(reopened, async (pullRequest) =>
      pullRequest.current === 'closed' &&
      !(await this.pullRequests.openAtStation(pullRequest.station.stationId))
        ? pullRequest.reopened(reopened.at ?? this.clock.now())
        : pullRequest,
    );
  }

  async lineChanged(lineId: string): Promise<void> {
    for (const each of await this.pullRequests.openedOnLine(lineId)) {
      await this.check(each.id);
    }
  }

  check(id: ConfigPullRequestId): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const pullRequest = await this.pullRequests.find(id);

      if (pullRequest?.current !== 'opened') {
        return;
      }

      const { lineId, stationId } = pullRequest.station;
      const live = await this.work.live(lineId, stationId);
      const checked = pullRequest.closeIfStale(
        live?.fingerprint ?? null,
        this.clock.now(),
      );

      if (checked !== pullRequest) {
        await this.pullRequests.save(checked);
      }
    });
  }

  private async changed(
    event: GitHubPullRequestEvent,
    change: (
      pullRequest: ConfigPullRequest,
    ) => ConfigPullRequest | Promise<ConfigPullRequest>,
  ): Promise<void> {
    const key = keyOf(event);

    if (!key) {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const pullRequest = await this.pullRequests.fromGitHub(
        event.workspaceId,
        key,
      );

      if (!pullRequest) {
        return;
      }

      const next = await change(pullRequest);

      if (next !== pullRequest) {
        await this.pullRequests.save(next);
      }
    });
  }
}
