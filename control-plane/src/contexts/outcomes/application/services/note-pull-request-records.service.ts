import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
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

export interface PullRequestForgottenByGitHub {
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
    private readonly forgotten: ForgottenPort,
    private readonly transaction: TransactionPort,
  ) {}

  seen(seen: PullRequestSeen): Promise<void> {
    return this.transaction.inTransaction(async () => {
      await this.forgotten.holding(seen.workspaceId, null);
      await this.forgotten.holdingPullRequest(
        seen.workspaceId,
        seen.pullRequest,
      );

      if (await this.forgotten.forgot(seen.workspaceId, null)) {
        return;
      }

      const tombstone = await this.forgotten.tombstoneOf(
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

  forgottenByGitHub(forgotten: PullRequestForgottenByGitHub): Promise<void> {
    return this.transaction.inTransaction(async () => {
      await this.forgotten.holding(forgotten.workspaceId, null);
      await this.forgotten.holdingPullRequest(
        forgotten.workspaceId,
        forgotten.pullRequest,
      );

      if (await this.forgotten.forgot(forgotten.workspaceId, null)) {
        return;
      }

      await this.forgotten.forgetPullRequest(
        forgotten.workspaceId,
        forgotten.pullRequest,
        { updatedAt: forgotten.updatedAt },
      );
      const held = await this.records.at(
        forgotten.workspaceId,
        forgotten.pullRequest,
      );

      if (!held) {
        return;
      }

      const kept = held.forgottenByGitHub(forgotten.updatedAt);

      if (kept === null) {
        await this.records.remove(held);
      } else if (kept !== held) {
        await this.records.save(kept);
      }
    });
  }

  owned(owned: PullRequestOwned): Promise<void> {
    return this.transaction.inTransaction(async () => {
      await this.forgotten.holding(
        owned.workspaceId,
        owned.taskId,
        owned.teamId,
      );
      await this.forgotten.holdingPullRequest(
        owned.workspaceId,
        owned.pullRequest,
      );

      if (
        await this.forgotten.forgot(
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
      await this.forgotten.holding(reviewed.workspaceId, reviewed.taskId);
      await this.forgotten.holdingPullRequest(
        reviewed.workspaceId,
        reviewed.pullRequest,
      );

      if (await this.forgotten.forgot(reviewed.workspaceId, reviewed.taskId)) {
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
    const held = await this.records.at(workspaceId, pullRequest);
    const changed = change(
      held ?? PullRequestRecord.noted(workspaceId, pullRequest),
    );

    if (!held) {
      await this.records.add(changed);
    } else if (changed !== held) {
      await this.records.save(changed);
    }
  }
}
