import type { CheckingPlan } from '@change-review/domain/value-objects/check-request.vo';
import type { AgentTurn } from '@shared-kernel/domain/value-objects/agent-turn.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORK = Symbol('WORK');

export interface RunForReview {
  readonly id: RunId;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId | null;
  readonly checking: CheckingPlan | null;
  readonly placement: RunnerPlacement;
  readonly working: boolean;
  readonly attempt: number;
  readonly orderedAt: Date | null;
  readonly decisions: boolean;
  readonly trial: boolean;
  readonly isolated: boolean;
  readonly checkouts: number;
}

const REASONED_STEP_KINDS = [
  'message',
  'thought',
  'planned',
  'handover',
  'remember',
] as const;

type ReasonedStepKind = (typeof REASONED_STEP_KINDS)[number];

export interface ReasonedStep {
  readonly index: number;
  readonly kind: ReasonedStepKind;
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
  readonly pullRequests: readonly PullRequestUrl[];
  readonly openPullRequests: readonly PullRequestUrl[];
  readonly reviewedPullRequest: PullRequestUrl | null;
  readonly reviewing: boolean;
  readonly currentRunId: RunId | null;
}

export interface WorkPort {
  run(runId: RunId): Promise<RunForReview | null>;

  teamOfRun(runId: RunId): Promise<TeamId | null>;

  repositoriesOfRun(runId: RunId): Promise<readonly Repository[]>;

  reasoningThrough(turn: AgentTurn): Promise<RunReasoning | null>;

  task(taskId: TaskId): Promise<ReviewedTask | null>;

  taskWithPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<ReviewedTask | null>;
}
