import type { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import type { ScopedRemoval } from '@insights/domain/repositories/scoped-removal';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PullRequestRecordRepository extends ScopedRemoval<PullRequestRecord> {
  at(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<PullRequestRecord | null>;

  ownedBy(taskIds: readonly TaskId[]): Promise<readonly PullRequestRecord[]>;

  add(record: PullRequestRecord): Promise<void>;

  save(record: PullRequestRecord): Promise<void>;

  tombstonesBefore(
    before: Date,
    max: number,
  ): Promise<readonly PullRequestRecord[]>;
}
