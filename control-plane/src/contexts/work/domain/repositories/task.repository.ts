import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Concerns } from '@work/domain/value-objects/concerns.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

export interface TaskRepository {
  add(task: Task): Promise<void>;

  save(task: Task): Promise<void>;

  find(id: TaskId): Promise<Task | null>;

  remove(task: Task): Promise<void>;

  allAtStation(stationId: StationId): Promise<Task[]>;

  // Locks the task until the transaction ends.
  findByMarks(
    workspaceId: WorkspaceId,
    concerns: Concerns,
  ): Promise<Task | null>;

  settingUpFor(teamId: TeamId): Promise<Task | null>;

  settingUpIn(workspaceId: WorkspaceId): Promise<readonly Task[]>;

  settingUp(): Promise<readonly Task[]>;

  awaitingConnection(
    teamId: TeamId,
    personId: UserId,
    source: string,
  ): Promise<readonly Task[]>;
}
