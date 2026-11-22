import type {
  RunContext,
  StationContext,
} from '@memory/domain/value-objects/run-context';
import type { AgentTurn } from '@shared-kernel/domain/value-objects/agent-turn.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORK = Symbol('WORK');

export interface NamedStationContext extends StationContext {
  readonly lineName: string;
  readonly stationName: string;
}

export interface RememberedRun {
  readonly id: RunId;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId | null;
  readonly attempt: number;
  readonly orderedAt: Date | null;
  readonly briefed: readonly string[];
  readonly omitted: readonly string[];
}

export interface LeasedRun extends RunContext {
  readonly id: RunId;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId | null;
  readonly asOf: Date | null;
  readonly isolated: boolean;
  readonly trial: boolean;
}

export interface RememberedTask {
  readonly id: TaskId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId | null;
  readonly fromOutside: boolean;
}

export interface ReasonedStep {
  readonly index: number;
  readonly kind: string;
  readonly text: string;
}

export interface TaskNote {
  readonly position: number;
  readonly by: 'person' | 'world';
  readonly author: UserId | null;
  readonly text: string;
}

export interface WorkPort {
  run(runId: RunId): Promise<RememberedRun | null>;

  leasedBy(runId: RunId, runner: RunnerId): Promise<LeasedRun | null>;

  contextOfRun(runId: RunId): Promise<RunContext | null>;

  memoryFilesRead(runId: RunId): Promise<readonly string[] | null>;

  stationContextOf(runId: RunId): Promise<NamedStationContext | null>;

  task(taskId: TaskId): Promise<RememberedTask | null>;

  reasoning(runId: RunId): Promise<readonly ReasonedStep[] | null>;

  reasoningThrough(turn: AgentTurn): Promise<readonly ReasonedStep[] | null>;

  notesOf(taskId: TaskId): Promise<readonly TaskNote[] | null>;

  harnessOf(runId: RunId): Promise<string | null>;
}
