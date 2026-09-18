import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import type { Mark } from '@work/domain/value-objects/mark.vo';

export class Concerns {
  private constructor(
    readonly taskId: TaskId | null,
    readonly marks: readonly Mark[],
  ) {}

  static of(input: {
    branch?: string | null;
    marks?: readonly (Mark | null)[];
  }): Concerns | null {
    const named = input.branch ? Branch.of(input.branch).taskId : null;
    const worn = (input.marks ?? []).filter((each): each is Mark => !!each);

    return named || worn.length > 0 ? new Concerns(named, worn) : null;
  }

  equals(other: Concerns): boolean {
    return (
      (this.taskId === null
        ? other.taskId === null
        : other.taskId !== null && this.taskId.equals(other.taskId)) &&
      this.marks.length === other.marks.length &&
      this.marks.every((each, index) => each.equals(other.marks[index]))
    );
  }
}
