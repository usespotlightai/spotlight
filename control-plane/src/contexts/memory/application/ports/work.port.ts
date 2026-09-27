import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORK = Symbol('WORK');

export interface WorkedPlace {
  readonly teamId: TeamId;
  readonly lineId: string;
  readonly lineName: string;
  readonly stationId: string;
  readonly stationName: string;
  readonly repositories: readonly Repository[];
}

export interface RememberedRun {
  readonly id: RunId;
  readonly taskId: TaskId | null;
  readonly completed: boolean;
  readonly memories: boolean;
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

export interface ChangedFile {
  readonly repository: Repository;
  readonly path: string;
}

export interface SpokenNote {
  readonly position: number;
  readonly by: 'person' | 'world';
  readonly text: string;
}

export interface WorkPort {
  run(runId: RunId): Promise<RememberedRun | null>;

  placeOf(runId: RunId): Promise<WorkedPlace | null>;

  task(taskId: TaskId): Promise<RememberedTask | null>;

  reasoning(runId: RunId): Promise<readonly ReasonedStep[] | null>;

  changedBy(runId: RunId): Promise<readonly ChangedFile[] | null>;

  spokenOn(taskId: TaskId): Promise<readonly SpokenNote[] | null>;
}
