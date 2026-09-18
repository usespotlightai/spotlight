import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { InvalidBranchError } from '@work/domain/exceptions/invalid-branch.error';

const UNDER = 'spotlight/';

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

  get isSpotlights(): boolean {
    return this.value.startsWith(UNDER);
  }

  equals(other: Branch): boolean {
    return this.value === other.value;
  }
}
