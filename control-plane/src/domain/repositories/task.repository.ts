import type { Task } from '@domain/aggregates/task.aggregate';
import type { Concerns } from '@domain/value-objects/concerns.vo';
import type { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { TaskRank } from '@domain/value-objects/task-rank.vo';

/** A task's place among those standing at a station. */
export interface TaskPlacement {
  readonly id: TaskId;
  readonly rank: TaskRank;
}

export interface TaskRepository {
  add(task: Task): Promise<void>;

  save(task: Task): Promise<void>;

  find(id: TaskId): Promise<Task | null>;

  remove(id: TaskId): Promise<void>;

  standingAt(stationId: StationId): Promise<Task[]>;

  /** Held until the change is written: a review's comments arrive at once. */
  holding(concerns: Concerns): Promise<Task | null>;

  withPullRequest(url: PullRequestUrl): Promise<Task | null>;

  /** Placing a task among these needs their order and nothing else. */
  placementsAt(stationId: StationId): Promise<TaskPlacement[]>;
}
