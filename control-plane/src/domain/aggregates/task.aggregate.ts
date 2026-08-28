import type { StationId } from '@domain/value-objects/station-id.vo';
import type { TaskDescription } from '@domain/value-objects/task-description.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import type { TaskTitle } from '@domain/value-objects/task-title.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class Task {
  private constructor(
    readonly id: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly stationId: StationId,
    readonly title: TaskTitle,
    readonly description: TaskDescription | null,
    readonly createdAt: Date,
  ) {}

  static add(input: {
    workspaceId: WorkspaceId;
    stationId: StationId;
    title: TaskTitle;
    description?: TaskDescription | null;
    now: Date;
    newId: () => string;
  }): Task {
    return new Task(
      TaskId.of(input.newId()),
      input.workspaceId,
      input.stationId,
      input.title,
      input.description ?? null,
      input.now,
    );
  }

  static rehydrate(input: {
    id: TaskId;
    workspaceId: WorkspaceId;
    stationId: StationId;
    title: TaskTitle;
    description: TaskDescription | null;
    createdAt: Date;
  }): Task {
    return new Task(
      input.id,
      input.workspaceId,
      input.stationId,
      input.title,
      input.description,
      input.createdAt,
    );
  }

  moveTo(stationId: StationId): Task {
    return new Task(
      this.id,
      this.workspaceId,
      stationId,
      this.title,
      this.description,
      this.createdAt,
    );
  }

  equals(other: Task): boolean {
    return this.id.equals(other.id);
  }
}
