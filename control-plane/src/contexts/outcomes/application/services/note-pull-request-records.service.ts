import type { DeletionsPort } from '@outcomes/application/ports/deletions.port';
import {
  PullRequestRecord,
  type SeenPullRequest,
} from '@outcomes/domain/aggregates/pull-request-record.aggregate';
import type { PullRequestRecordRepository } from '@outcomes/domain/repositories/pull-request-record.repository';
import { outlivesTombstone } from '@outcomes/domain/services/pull-request-tombstone';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PullRequestSeen {
  readonly workspaceId: WorkspaceId;
  readonly pullRequest: PullRequestUrl;
  readonly seen: SeenPullRequest;
}

export interface PullRequestPurgedByGitHub {
  readonly workspaceId: WorkspaceId;
  readonly pullRequest: PullRequestUrl;
  readonly updatedAt: Date;
}

export interface PullRequestOwned {
  readonly workspaceId: WorkspaceId;
  readonly pullRequest: PullRequestUrl;
  readonly taskId: TaskId;
  readonly teamId: TeamId;
}

export interface PullRequestReviewed {
  readonly workspaceId: WorkspaceId;
  readonly pullRequest: PullRequestUrl;
  readonly taskId: TaskId;
}

export class NotePullRequestRecords {
  constructor(
    private readonly records: PullRequestRecordRepository,
    private readonly deletions: DeletionsPort,
    private readonly transaction: TransactionPort,
  ) {}

  seen(seen: PullRequestSeen): Promise<void> {
    return this.transaction.inTransaction(async () => {
      await this.deletions.lockDeletion(seen.workspaceId, null);
      await this.deletions.lockPullRequestDeletion(
        seen.workspaceId,
        seen.pullRequest,
      );

      if (await this.deletions.isDeleted(seen.workspaceId, null)) {
        return;
      }

      const tombstone = await this.deletions.tombstoneOf(
        seen.workspaceId,
        seen.pullRequest,
      );

      if (tombstone && !outlivesTombstone(seen.seen, tombstone)) {
        return;
      }

      await this.changing(seen.workspaceId, seen.pullRequest, (record) =>
        record.seenAs(seen.seen),
      );
    });
  }

  purgedByGitHub(purged: PullRequestPurgedByGitHub): Promise<void> {
    return this.transaction.inTransaction(async () => {
      await this.deletions.lockDeletion(purged.workspaceId, null);
      await this.deletions.lockPullRequestDeletion(
        purged.workspaceId,
        purged.pullRequest,
      );

      if (await this.deletions.isDeleted(purged.workspaceId, null)) {
        return;
      }

      await this.deletions.deletePullRequest(
        purged.workspaceId,
        purged.pullRequest,
        { updatedAt: purged.updatedAt },
      );
      const existing = await this.records.at(
        purged.workspaceId,
        purged.pullRequest,
      );

      if (!existing) {
        return;
      }

      const kept = existing.purgedByGitHub(purged.updatedAt);

      if (kept === null) {
        await this.records.remove(existing);
      } else if (kept !== existing) {
        await this.records.save(kept);
      }
    });
  }

  owned(owned: PullRequestOwned): Promise<void> {
    return this.transaction.inTransaction(async () => {
      await this.deletions.lockDeletion(
        owned.workspaceId,
        owned.taskId,
        owned.teamId,
      );
      await this.deletions.lockPullRequestDeletion(
        owned.workspaceId,
        owned.pullRequest,
      );

      if (
        await this.deletions.isDeleted(
          owned.workspaceId,
          owned.taskId,
          owned.teamId,
        )
      ) {
        return;
      }

      await this.changing(owned.workspaceId, owned.pullRequest, (record) =>
        record.assignOwner({ taskId: owned.taskId, teamId: owned.teamId }),
      );
    });
  }

  reviewed(reviewed: PullRequestReviewed): Promise<void> {
    return this.transaction.inTransaction(async () => {
      await this.deletions.lockDeletion(reviewed.workspaceId, reviewed.taskId);
      await this.deletions.lockPullRequestDeletion(
        reviewed.workspaceId,
        reviewed.pullRequest,
      );

      if (
        await this.deletions.isDeleted(reviewed.workspaceId, reviewed.taskId)
      ) {
        return;
      }

      await this.changing(
        reviewed.workspaceId,
        reviewed.pullRequest,
        (record) => record.recordReview(reviewed.taskId),
      );
    });
  }

  private async changing(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
    change: (record: PullRequestRecord) => PullRequestRecord,
  ): Promise<void> {
    const existing = await this.records.at(workspaceId, pullRequest);
    const changed = change(
      existing ?? PullRequestRecord.noted(workspaceId, pullRequest),
    );

    if (!existing) {
      await this.records.add(changed);
    } else if (changed !== existing) {
      await this.records.save(changed);
    }
  }
}
