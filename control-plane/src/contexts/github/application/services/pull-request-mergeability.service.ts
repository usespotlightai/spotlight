import { MergeabilityUnknownError } from '@github/application/errors/mergeability-unknown.error';
import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { DeliveryOrigin } from '@github/application/services/pull-request-sync.service';
import type { PullRequest } from '@github/domain/aggregates/pull-request.aggregate';
import type { PullRequestBaseMoved } from '@github/domain/events/pull-request-base-moved.event';
import { PullRequestVersionConflictError } from '@github/domain/exceptions/pull-request-version-conflict.error';
import type { GitHubConnectionRepository } from '@github/domain/repositories/github-connection.repository';
import type { PullRequestRepository } from '@github/domain/repositories/pull-request.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const ATTEMPTS = 3;

export class PullRequestMergeability {
  constructor(
    private readonly pullRequests: PullRequestRepository,
    private readonly connections: GitHubConnectionRepository,
    private readonly github: Pick<PullRequestPort, 'mergeabilityOf'>,
    private readonly transaction: TransactionPort,
  ) {}

  // Calls no GitHub API: the subscriber of each base move reads the mergeability, apart from the delivery.
  async baseMoved(
    from: DeliveryOrigin,
    repository: Repository,
    base: string,
  ): Promise<void> {
    const connected = await this.connections.connectedWorkspaceOf(
      from.installation,
    );

    if (!connected?.equals(from.workspaceId)) {
      return;
    }

    for (const each of await this.pullRequests.openIn(
      from.workspaceId,
      repository,
    )) {
      await this.changing(from.workspaceId, each.url, (known) =>
        known.baseMoved(base),
      );
    }
  }

  async check(moved: PullRequestBaseMoved): Promise<void> {
    const read = await this.github.mergeabilityOf({
      workspaceId: moved.workspaceId,
      repository: moved.repository,
      number: moved.number,
    });

    if (read.state !== 'open') {
      return;
    }

    const { mergeable } = read;

    if (mergeable === null) {
      throw new MergeabilityUnknownError(moved.pullRequest.value);
    }

    await this.changing(moved.workspaceId, moved.pullRequest, (known) =>
      known.readMergeability({
        mergeable,
        branch: read.branch,
        base: read.base ?? moved.base,
      }),
    );
  }

  private async changing(
    workspaceId: WorkspaceId,
    url: PullRequestUrl,
    change: (pullRequest: PullRequest) => PullRequest,
  ): Promise<void> {
    for (let left = ATTEMPTS; ; left -= 1) {
      try {
        await this.transaction.inTransaction(async () => {
          const locked = await this.pullRequests.lockedAt(workspaceId, url);

          if (!locked) {
            return;
          }

          const changed = change(locked);

          if (changed !== locked) {
            await this.pullRequests.save(changed);
          }
        });
        return;
      } catch (error) {
        if (!(error instanceof PullRequestVersionConflictError) || left <= 1) {
          throw error;
        }
      }
    }
  }
}
