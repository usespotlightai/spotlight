import type { Label } from '@domain/aggregates/label.aggregate';
import type { LabelId } from '@domain/value-objects/label-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';

export interface LabelRepository {
  add(label: Label): Promise<void>;

  save(label: Label): Promise<void>;

  find(id: LabelId): Promise<Label | null>;

  remove(id: LabelId): Promise<void>;

  forTeam(teamId: TeamId): Promise<Label[]>;

  forTask(taskId: TaskId): Promise<Label[]>;

  attachToTask(labelId: LabelId, taskId: TaskId): Promise<void>;

  detachFromTask(labelId: LabelId, taskId: TaskId): Promise<void>;
}

export const LABEL_REPOSITORY = Symbol('LABEL_REPOSITORY');
