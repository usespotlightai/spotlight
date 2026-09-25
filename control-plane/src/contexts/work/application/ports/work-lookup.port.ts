import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORK_LOOKUP = Symbol('WORK_LOOKUP');

export interface RunLookup {
  readonly id: RunId;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId | null;
  readonly check: string | null;
  readonly setups: ReadonlyMap<string, string>;
  readonly placement: RunnerPlacement;
  readonly decisions: boolean;
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

export interface TaskLookup {
  readonly id: TaskId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId | null;
  readonly pullRequest: PullRequestUrl | null;
  readonly reviewing: boolean;
  readonly currentRunId: RunId | null;
}

export interface WorkLookupPort {
  run(runId: RunId): Promise<RunLookup | null>;

  wasWorkedBy(runId: RunId, runner: RunnerId): Promise<boolean>;

  reasoning(runId: RunId): Promise<RunReasoning | null>;

  task(taskId: TaskId): Promise<TaskLookup | null>;

  taskWithPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<TaskLookup | null>;
}
