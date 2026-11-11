import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ReviewedPullRequest } from '@work/domain/value-objects/reviewed-pull-request.vo';
import type { Voice } from '@work/domain/value-objects/voice.vo';

export const TASK_LOOKUP_READER = Symbol('TASK_LOOKUP_READER');

export interface TaskLookupReading {
  readonly id: TaskId;
  readonly workspaceId: WorkspaceId;
  readonly stationId: StationId;
  readonly reviewedPullRequest: ReviewedPullRequest | null;
  readonly pullRequests: readonly PullRequestUrl[];
  readonly openPullRequests: readonly PullRequestUrl[];
  readonly currentRunId: RunId | null;
}

export interface TaskNoteReading {
  readonly position: number;
  readonly voice: Voice;
  readonly body: string;
}

export interface TaskLookupReaderPort {
  find(taskId: TaskId): Promise<TaskLookupReading | null>;

  notesOf(taskId: TaskId): Promise<readonly TaskNoteReading[] | null>;
}
