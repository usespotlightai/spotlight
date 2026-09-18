import type { StackCheck } from '@change-review/domain/value-objects/stack-check.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORK = Symbol('WORK');

export interface ReviewedRun {
  readonly id: RunId;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId | null;
  readonly check: StackCheck | null;
}

export interface ReviewedTask {
  readonly id: TaskId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId | null;
  readonly pullRequest: PullRequestUrl | null;
}

export interface WorkPort {
  run(runId: RunId): Promise<ReviewedRun | null>;

  wasWorkedBy(runId: RunId, runner: RunnerId): Promise<boolean>;

  task(taskId: TaskId): Promise<ReviewedTask | null>;

  taskWithPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<ReviewedTask | null>;
}
