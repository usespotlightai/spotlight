import type { Task } from '@domain/aggregates/task.aggregate';
import type { Concerns } from '@domain/value-objects/concerns.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { TaskRank } from '@domain/value-objects/task-rank.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export interface TaskPlacement {
  readonly id: TaskId;
  readonly rank: TaskRank;
}

export interface StandingSetup {
  readonly teamId: TeamId;
  readonly task: Task;
}

export interface SetupLists {
  settingUpFor(teamId: TeamId): Promise<StandingSetup | null>;

  settingUpIn(workspaceId: WorkspaceId): Promise<readonly StandingSetup[]>;

  settingUp(): Promise<readonly StandingSetup[]>;

  save(task: Task): Promise<void>;
}

export interface TaskRepository {
  add(task: Task): Promise<void>;

  save(task: Task): Promise<void>;

  find(id: TaskId): Promise<Task | null>;

  remove(id: TaskId): Promise<void>;

  standingAt(stationId: StationId): Promise<Task[]>;

  countsAt(
    stationIds: readonly StationId[],
  ): Promise<ReadonlyMap<string, number>>;

  // Locked until written (comments arrive together); workspace-scoped so no host reaches another workspace's task.
  holding(workspaceId: WorkspaceId, concerns: Concerns): Promise<Task | null>;

  placementsAt(stationId: StationId): Promise<TaskPlacement[]>;
}
