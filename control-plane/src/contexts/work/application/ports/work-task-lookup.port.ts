import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORK_TASK_LOOKUP = Symbol('WORK_TASK_LOOKUP');

export interface TaskNoteView {
  readonly position: number;
  readonly by: 'person' | 'world';
  readonly author: string | null;
  readonly text: string;
}

export interface TaskLookup {
  readonly id: TaskId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId | null;
  readonly pullRequest: PullRequestUrl | null;
  readonly pullRequests: readonly PullRequestUrl[];
  readonly reviewing: boolean;
  readonly fromOutside: boolean;
  readonly currentRunId: RunId | null;
}

export interface WorkTaskLookupPort {
  task(taskId: TaskId): Promise<TaskLookup | null>;

  taskWithPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<TaskLookup | null>;

  notesOf(taskId: TaskId): Promise<readonly TaskNoteView[] | null>;
}
