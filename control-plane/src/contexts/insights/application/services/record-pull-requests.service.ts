import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import type { PullRequestRecordRepository } from '@insights/domain/repositories/pull-request-record.repository';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import {
  type ObservedPullRequest,
  SeenPullRequest,
} from '@insights/domain/value-objects/seen-pull-request.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface PullRequestAt {
  readonly workspaceId: WorkspaceId;
  readonly pullRequest: PullRequestUrl;
}

export interface PullRequestSeen {
  readonly workspaceId: WorkspaceId;
  readonly pullRequest: PullRequestUrl;
  readonly observed: ObservedPullRequest;
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
  readonly at: Date;
}

export interface PullRequestReviewed {
  readonly workspaceId: WorkspaceId;
  readonly pullRequest: PullRequestUrl;
  readonly taskId: TaskId;
  readonly teamId: TeamId;
}

export class RecordPullRequests {
  constructor(
    private readonly records: PullRequestRecordRepository,
    private readonly recorder: FactRecorder,
    private readonly transaction: TransactionPort,
  ) {}

  seen(seen: PullRequestSeen): Promise<void> {
    const observed = SeenPullRequest.observed(seen.observed);

    return this.changing(seen, null, (record) => record.seenAs(observed));
  }

  purgedByGitHub(purged: PullRequestPurgedByGitHub): Promise<void> {
    return this.changing(purged, null, (record) =>
      record.purgedByGitHub(purged.updatedAt),
    );
  }

  owned(owned: PullRequestOwned): Promise<void> {
    return this.changing(
      owned,
      FactOwner.of(owned.workspaceId, {
        teamId: owned.teamId,
        taskId: owned.taskId,
      }),
      (record) =>
        record.assignOwner({
          taskId: owned.taskId,
          teamId: owned.teamId,
          openedAt: owned.at,
        }),
    );
  }

  reviewed(reviewed: PullRequestReviewed): Promise<void> {
    return this.changing(
      reviewed,
      FactOwner.of(reviewed.workspaceId, {
        teamId: reviewed.teamId,
        taskId: reviewed.taskId,
      }),
      (record) =>
        record.recordReview({
          taskId: reviewed.taskId,
          teamId: reviewed.teamId,
        }),
    );
  }

  private changing(
    { workspaceId, pullRequest }: PullRequestAt,
    referenced: FactOwner | null,
    change: (record: PullRequestRecord) => PullRequestRecord,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      if (referenced && !(await this.recorder.admits(referenced))) {
        return;
      }

      await this.recorder.record(this.records, {
        owner: FactOwner.of(workspaceId),
        deleted: (existing) => existing.delete(),
        load: () => this.records.at(workspaceId, pullRequest),
        fresh: () => PullRequestRecord.noted(workspaceId, pullRequest),
        change,
      });
    });
  }
}
