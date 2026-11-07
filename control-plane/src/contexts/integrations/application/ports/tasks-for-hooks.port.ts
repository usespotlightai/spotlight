import type { NoticeFileView } from '@integrations/application/ports/integration-runtime.port';
import type { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const TASKS_FOR_HOOKS = Symbol('TASKS_FOR_HOOKS');

export interface TaskWaitingView {
  readonly conversationId: string;
  readonly body: string;
  readonly awaitsApproval: boolean;
  readonly attachments: readonly NoticeFileView[];
}

export interface TaskView {
  readonly taskId: TaskId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly title: string;
  readonly url: string | null;
  readonly line: LineKey;
  readonly station: StationName;
  readonly stationKey: StationKey;
  readonly marks: Readonly<Record<string, string>>;
  readonly repositories: readonly Repository[];
  readonly pullRequest: PullRequestUrl | null;
  readonly runId: RunId | null;
  readonly waiting: TaskWaitingView | null;
}

export type UnlinkedTaskView = Omit<TaskView, 'url'>;

export type LinkedTaskView = TaskView & { readonly url: string };

export interface TasksForHooksPort {
  of(taskId: TaskId, runId: RunId | null): Promise<LinkedTaskView | null>;

  ofPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<LinkedTaskView | null>;
}
