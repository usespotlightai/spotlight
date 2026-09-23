import type { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
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
  readonly request: CheckRequest | null;
  readonly ended: boolean;
  readonly completed: boolean;
  readonly decisions: boolean;
}

export interface ReasonedStep {
  readonly index: number;
  readonly kind: string;
  readonly text: string;
}

export interface RunReasoning {
  readonly steps: readonly ReasonedStep[];
  readonly changed: readonly string[];
}

export interface ReviewedTask {
  readonly id: TaskId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId | null;
  readonly pullRequest: PullRequestUrl | null;
  readonly reviewing: boolean;
  readonly currentRunId: RunId | null;
}

export interface WorkPort {
  run(runId: RunId): Promise<ReviewedRun | null>;

  wasWorkedBy(runId: RunId, runner: RunnerId): Promise<boolean>;

  reasoning(runId: RunId): Promise<RunReasoning | null>;

  task(taskId: TaskId): Promise<ReviewedTask | null>;

  taskWithPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<ReviewedTask | null>;
}
