import { InvalidBranchError } from '@domain/exceptions/invalid-branch.error';
import { TaskId } from '@domain/value-objects/task-id.vo';

const UNDER = 'spotlight/';

/** One branch per task, named after it: anything carrying one says whose
 *  work it is about, which is how a check suite finds its task. */
export class Branch {
  private constructor(readonly value: string) {}

  static for(taskId: TaskId): Branch {
    return new Branch(`${UNDER}${taskId.value}`);
  }

  static of(raw: string): Branch {
    const named = raw.trim();

    if (named.length === 0) {
      throw new InvalidBranchError('must be named');
    }

    return new Branch(named);
  }

  get taskId(): TaskId | null {
    return this.value.startsWith(UNDER) && this.value.length > UNDER.length
      ? TaskId.of(this.value.slice(UNDER.length))
      : null;
  }

  equals(other: Branch): boolean {
    return this.value === other.value;
  }
}
