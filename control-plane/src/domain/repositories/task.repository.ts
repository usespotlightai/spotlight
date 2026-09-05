import type { Task } from '@domain/aggregates/task.aggregate';
import type { Concerns } from '@domain/value-objects/concerns.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { TaskRank } from '@domain/value-objects/task-rank.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

/** A task's place among those standing at a station. */
export interface TaskPlacement {
  readonly id: TaskId;
  readonly rank: TaskRank;
}

/** A setup list and whose it is, which the task itself does not know. */
export interface StandingSetup {
  readonly teamId: TeamId;
  readonly task: Task;
}

/**
 * The lists teams are still working through. Apart from the rest of a task's
 * repository because settling one is all this is for.
 */
export interface SetupLists {
  settingUpFor(teamId: TeamId): Promise<StandingSetup | null>;

  settingUpIn(workspaceId: WorkspaceId): Promise<readonly StandingSetup[]>;

  /** Every list still standing anywhere, for the step no team takes alone. */
  settingUp(): Promise<readonly StandingSetup[]>;

  save(task: Task): Promise<void>;
}

export interface TaskRepository {
  add(task: Task): Promise<void>;

  save(task: Task): Promise<void>;

  find(id: TaskId): Promise<Task | null>;

  remove(id: TaskId): Promise<void>;

  standingAt(stationId: StationId): Promise<Task[]>;

  /**
   * Held until the change is written: a review's comments arrive at once.
   * Scoped to the workspace the word came from, so one workspace's host can
   * never name another's task, however it addresses it.
   */
  holding(workspaceId: WorkspaceId, concerns: Concerns): Promise<Task | null>;

  /** Placing a task among these needs their order and nothing else. */
  placementsAt(stationId: StationId): Promise<TaskPlacement[]>;
}
