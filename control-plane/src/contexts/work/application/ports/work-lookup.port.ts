import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORK_LOOKUP = Symbol('WORK_LOOKUP');

export interface RunPlace {
  readonly teamId: TeamId;
  readonly lineId: string;
  readonly lineName: string;
  readonly stationId: string;
  readonly stationName: string;
  readonly repositories: readonly Repository[];
}

export interface RunLookup {
  readonly id: RunId;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId | null;
  readonly check: string | null;
  readonly setups: ReadonlyMap<string, string>;
  readonly placement: RunnerPlacement;
  readonly decisions: boolean;
  readonly memories: boolean;
  readonly ended: boolean;
  readonly completed: boolean;
}

export interface ReasonedStep {
  readonly index: number;
  readonly kind: 'said' | 'thought' | 'planned' | 'handover';
  readonly text: string;
}

export interface RunReasoning {
  readonly steps: readonly ReasonedStep[];
  readonly changed: readonly string[];
}

export interface ChangedFile {
  readonly repository: Repository;
  readonly path: string;
}

export interface SpokenNote {
  readonly position: number;
  readonly by: 'person' | 'world';
  readonly text: string;
}

export interface TaskLookup {
  readonly id: TaskId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId | null;
  readonly pullRequest: PullRequestUrl | null;
  readonly reviewing: boolean;
  readonly fromOutside: boolean;
  readonly currentRunId: RunId | null;
}

export interface WorkLookupPort {
  run(runId: RunId): Promise<RunLookup | null>;

  wasWorkedBy(runId: RunId, runner: RunnerId): Promise<boolean>;

  placeOf(runId: RunId): Promise<RunPlace | null>;

  reasoning(runId: RunId): Promise<RunReasoning | null>;

  changedBy(runId: RunId): Promise<readonly ChangedFile[] | null>;

  spokenOn(taskId: TaskId): Promise<readonly SpokenNote[] | null>;

  task(taskId: TaskId): Promise<TaskLookup | null>;

  taskWithPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<TaskLookup | null>;
}
