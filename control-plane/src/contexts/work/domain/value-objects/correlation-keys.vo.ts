import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import type { Mark } from '@work/domain/value-objects/mark.vo';

export class CorrelationKeys {
  private constructor(
    readonly taskId: TaskId | null,
    readonly marks: readonly Mark[],
  ) {}

  static of(input: {
    branch?: string | null;
    marks?: readonly (Mark | null)[];
  }): CorrelationKeys | null {
    const named = input.branch ? Branch.of(input.branch).taskId : null;
    const marked = (input.marks ?? []).filter((each): each is Mark => !!each);

    return named || marked.length > 0
      ? new CorrelationKeys(named, marked)
      : null;
  }

  equals(other: CorrelationKeys): boolean {
    return (
      (this.taskId === null
        ? other.taskId === null
        : other.taskId !== null && this.taskId.equals(other.taskId)) &&
      this.marks.length === other.marks.length &&
      this.marks.every((each, index) => each.equals(other.marks[index]))
    );
  }
}
