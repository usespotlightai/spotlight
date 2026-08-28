import type { Task } from '@domain/aggregates/task.aggregate';
import type { StationId } from '@domain/value-objects/station-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';

export interface TaskRepository {
  add(task: Task): Promise<void>;

  save(task: Task): Promise<void>;

  find(id: TaskId): Promise<Task | null>;

  remove(id: TaskId): Promise<void>;

  standingAt(stationId: StationId): Promise<Task[]>;
}
