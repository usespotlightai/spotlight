import type { PullRequestRecord } from '@outcomes/domain/aggregates/pull-request-record.aggregate';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PullRequestRecordRepository {
  at(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<PullRequestRecord | null>;

  add(record: PullRequestRecord): Promise<void>;

  save(record: PullRequestRecord): Promise<void>;

  remove(record: PullRequestRecord): Promise<void>;

  findByTask(
    workspaceId: WorkspaceId,
    taskId: TaskId,
  ): Promise<readonly PullRequestRecord[]>;

  ownedByTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<readonly PullRequestRecord[]>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
