import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const TASKS_FOR_HOOKS = Symbol('TASKS_FOR_HOOKS');

export interface TaskView {
  readonly taskId: TaskId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly title: string;
  readonly url: string;
  readonly line: string;
  readonly station: string;
  readonly stationKey: StationKey;
  readonly marks: Readonly<Record<string, string>>;
  readonly repositories: readonly string[];
  readonly pullRequest: string | null;
  readonly runId: RunId | null;
}

export interface TasksForHooksPort {
  of(taskId: TaskId, runId: RunId | null): Promise<TaskView | null>;

  ofPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<TaskView | null>;
}
