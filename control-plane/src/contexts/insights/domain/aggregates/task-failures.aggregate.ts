import type { FailureOccurrence } from '@insights/domain/value-objects/failure-occurrence.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const byTime = (one: FailureOccurrence, other: FailureOccurrence): number =>
  one.at.getTime() - other.at.getTime();

export class TaskFailures {
  private constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly occurrences: readonly FailureOccurrence[],
    readonly version: number,
  ) {}

  static empty(
    taskId: TaskId,
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): TaskFailures {
    return new TaskFailures(taskId, workspaceId, teamId, [], 0);
  }

  static rehydrate(input: {
    taskId: TaskId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    occurrences: readonly FailureOccurrence[];
    version: number;
  }): TaskFailures {
    return new TaskFailures(
      input.taskId,
      input.workspaceId,
      input.teamId,
      [...input.occurrences].sort(byTime),
      input.version,
    );
  }

  get lastAt(): Date | null {
    return this.occurrences[this.occurrences.length - 1]?.at ?? null;
  }

  raise(occurrence: FailureOccurrence): TaskFailures {
    if (this.occurrences.some((each) => each.sameAs(occurrence))) {
      return this;
    }

    return new TaskFailures(
      this.taskId,
      this.workspaceId,
      this.teamId,
      [...this.occurrences, occurrence].sort(byTime),
      this.version,
    );
  }
}
