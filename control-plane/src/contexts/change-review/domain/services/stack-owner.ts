import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface StackOwner {
  readonly taskId: TaskId | null;
  readonly teamId: TeamId | null;
  readonly trial?: boolean;
}

export const assertOneOwner = (what: string, owner: StackOwner): void => {
  if (owner.trial && owner.taskId) {
    throw new InconsistentStateError(
      what,
      'is a trial’s, yet belongs to a task',
    );
  }
  if ((owner.taskId === null) === (owner.teamId === null)) {
    throw new InconsistentStateError(
      what,
      'must belong to either a task or, without a task, to a team',
    );
  }
};
