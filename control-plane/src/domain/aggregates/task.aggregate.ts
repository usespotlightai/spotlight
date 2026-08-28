import type { StationId } from '@domain/value-objects/station-id.vo';
import type { TaskDescription } from '@domain/value-objects/task-description.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import type { TaskRank } from '@domain/value-objects/task-rank.vo';
import type { TaskTitle } from '@domain/value-objects/task-title.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class Task {
  private constructor(
    readonly id: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly stationId: StationId,
    readonly title: TaskTitle,
    readonly description: TaskDescription | null,
    readonly rank: TaskRank,
    readonly createdAt: Date,
  ) {}

  static add(input: {
    workspaceId: WorkspaceId;
    stationId: StationId;
    title: TaskTitle;
    description?: TaskDescription | null;
    rank: TaskRank;
    now: Date;
    newId: () => string;
  }): Task {
    return new Task(
      TaskId.of(input.newId()),
      input.workspaceId,
      input.stationId,
      input.title,
      input.description ?? null,
      input.rank,
      input.now,
    );
  }

  static rehydrate(input: {
    id: TaskId;
    workspaceId: WorkspaceId;
    stationId: StationId;
    title: TaskTitle;
    description: TaskDescription | null;
    rank: TaskRank;
    createdAt: Date;
  }): Task {
    return new Task(
      input.id,
      input.workspaceId,
      input.stationId,
      input.title,
      input.description,
      input.rank,
      input.createdAt,
    );
  }

  moveTo(stationId: StationId, rank: TaskRank): Task {
    return this.placed(stationId, rank);
  }

  reorderTo(rank: TaskRank): Task {
    return this.placed(this.stationId, rank);
  }

  private placed(stationId: StationId, rank: TaskRank): Task {
    return new Task(
      this.id,
      this.workspaceId,
      stationId,
      this.title,
      this.description,
      rank,
      this.createdAt,
    );
  }

  equals(other: Task): boolean {
    return this.id.equals(other.id);
  }
}
