import { PullRequestsNotPurgedError } from '@github/application/errors/pull-requests-not-purged.error';
import {
  PullRequest,
  type PullRequestFacts,
  type WebhookComment,
  type WebhookReview,
} from '@github/domain/aggregates/pull-request.aggregate';
import type { PullRequestRevertMerged } from '@github/domain/events/pull-request-revert-merged.event';
import { PullRequestVersionConflictError } from '@github/domain/exceptions/pull-request-version-conflict.error';
import type { GitHubConnectionRepository } from '@github/domain/repositories/github-connection.repository';
import type { PullRequestRepository } from '@github/domain/repositories/pull-request.repository';
import { retentionCutoff } from '@github/domain/services/pull-request-retention';
import type { PullRequestThread } from '@github/domain/value-objects/bot-activity.vo';
import type { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const ATTEMPTS = 3;

const PURGE_BATCH = 200;

export interface WebhookSource {
  readonly installation: GitHubInstallation;
  readonly workspaceId: WorkspaceId;
}

interface Purging {
  readonly purged: number;
  readonly left: number;
}

const urlOf = (raw: string): PullRequestUrl | null => {
  try {
    return PullRequestUrl.of(raw);
  } catch {
    return null;
  }
};

export class RecordPullRequests {
  constructor(
    private readonly pullRequests: PullRequestRepository,
    private readonly connections: GitHubConnectionRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  described(from: WebhookSource, facts: PullRequestFacts): Promise<void> {
    return this.changing(from, facts.url, facts, (known) => known);
  }

  async reviewed(
    from: WebhookSource,
    pullRequest: string,
    facts: PullRequestFacts | null,
    review: WebhookReview,
  ): Promise<void> {
    const url = urlOf(pullRequest);

    if (url) {
      await this.changing(from, url, facts, (known) =>
        known.recordReview(review),
      );
    }
  }

  async reviewDismissed(
    from: WebhookSource,
    pullRequest: string,
    facts: PullRequestFacts | null,
    review: number,
  ): Promise<void> {
    const url = urlOf(pullRequest);

    if (url) {
      await this.changing(from, url, facts, (known) =>
        known.dismissReview(review),
      );
    }
  }

  async commented(
    from: WebhookSource,
    pullRequest: string,
    facts: PullRequestFacts | null,
    comment: WebhookComment,
  ): Promise<void> {
    const url = urlOf(pullRequest);

    if (url) {
      await this.changing(from, url, facts, (known) =>
        known.recordComment(comment),
      );
    }
  }

  async threadResolved(
    from: WebhookSource,
    pullRequest: string,
    facts: PullRequestFacts | null,
    thread: PullRequestThread,
  ): Promise<void> {
    const url = urlOf(pullRequest);

    if (url) {
      await this.changing(from, url, facts, (known) =>
        known.resolveThread(thread),
      );
    }
  }

  async revertMerged(event: PullRequestRevertMerged): Promise<void> {
    const revert = urlOf(event.pullRequest);

    if (!revert) {
      return;
    }

    const repository = Repository.of(event.repository);

    await this.retrying(() =>
      this.transaction.inTransaction(async () => {
        const target =
          event.reverts.kind === 'number'
            ? await this.pullRequests.numbered(
                event.workspaceId,
                repository,
                event.reverts.number,
              )
            : await this.pullRequests.lastMergedTitled(
                event.workspaceId,
                repository,
                event.reverts.title,
              );

        if (!target) {
          return;
        }

        const reverted = target.recordRevert(revert);

        if (reverted !== target) {
          await this.pullRequests.save(reverted);
        }
      }),
    );
  }

  async pastRetention(): Promise<number> {
    const now = this.clock.now();
    let purged = 0;
    let after: PullRequest | null = null;

    for (;;) {
      const candidates = await this.pullRequests.lastUpdatedBefore(
        retentionCutoff(now),
        after,
        PURGE_BATCH,
      );
      const batch = await this.purging(
        candidates,
        (candidate) =>
          this.pullRequests.lockedUnlessBusy(
            candidate.workspaceId,
            candidate.url,
          ),
        (known) => known.isPastRetention(now),
      );
      purged += batch.purged;
      after = candidates[candidates.length - 1] ?? after;

      if (candidates.length < PURGE_BATCH) {
        return purged;
      }
    }
  }

  async uninstalled(workspaceId: WorkspaceId): Promise<number> {
    let purged = 0;
    let left = 0;
    let after: PullRequestUrl | null = null;

    for (;;) {
      const candidates = await this.pullRequests.ofWorkspace(
        workspaceId,
        after,
        PURGE_BATCH,
      );
      const batch = await this.purging(
        candidates,
        (candidate) =>
          this.pullRequests.lockedAt(candidate.workspaceId, candidate.url),
        () => true,
      );
      purged += batch.purged;
      left += batch.left;
      after = candidates[candidates.length - 1]?.url ?? after;

      if (candidates.length < PURGE_BATCH) {
        break;
      }
    }

    if (left > 0) {
      throw new PullRequestsNotPurgedError(left);
    }

    return purged;
  }

  async workspaceDeleted(workspaceId: WorkspaceId): Promise<void> {
    await this.transaction.inTransaction(async () => {
      const connection = await this.connections.of(workspaceId);

      if (connection.installation) {
        await this.connections.save(
          connection.disconnectFrom(connection.installation),
        );
      }
    });
    await this.pullRequests.removeForWorkspace(workspaceId);
  }

  private async purging(
    candidates: readonly PullRequest[],
    locked: (candidate: PullRequest) => Promise<PullRequest | null>,
    purgeable: (pullRequest: PullRequest) => boolean,
  ): Promise<Purging> {
    let purged = 0;
    let left = 0;

    for (const candidate of candidates) {
      try {
        await this.transaction.inTransaction(async () => {
          const current = await locked(candidate);

          if (current && purgeable(current)) {
            await this.pullRequests.remove(current.purge());
            purged += 1;
          }
        });
      } catch (error) {
        left += 1;
        this.logger.error(
          { err: error, pullRequest: candidate.url.value },
          'Purging a pull request',
        );
      }
    }

    return { purged, left };
  }

  private changing(
    from: WebhookSource,
    url: PullRequestUrl,
    facts: PullRequestFacts | null,
    change: (pullRequest: PullRequest) => PullRequest,
  ): Promise<void> {
    const described = facts?.url.equals(url) ? facts : null;
    const { workspaceId } = from;

    return this.retrying(() =>
      this.transaction.inTransaction(async () => {
        const claimant = await this.connections.lockedClaimantOf(
          from.installation,
        );

        if (!claimant?.equals(workspaceId)) {
          return;
        }

        const locked = await this.pullRequests.lockedAt(workspaceId, url);

        if (locked) {
          const changed = change(
            described ? locked.describe(described) : locked,
          );

          if (changed !== locked) {
            await this.pullRequests.save(changed);
          }
          return;
        }

        const first = described
          ? PullRequest.fromWebhook(workspaceId, described, this.clock.now())
          : null;

        if (first) {
          await this.pullRequests.add(change(first));
        }
      }),
    );
  }

  private async retrying(attempt: () => Promise<void>): Promise<void> {
    for (let left = ATTEMPTS; ; left -= 1) {
      try {
        await attempt();
        return;
      } catch (error) {
        if (!(error instanceof PullRequestVersionConflictError) || left <= 1) {
          throw error;
        }
      }
    }
  }
}
