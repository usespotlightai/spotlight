import { InvalidTaskRevisionError } from '@work/domain/exceptions/invalid-task-revision.error';

export class TaskRevision {
  private constructor(readonly value: number) {}

  static of(value: number): TaskRevision {
    if (!Number.isInteger(value) || value < 0) {
      throw new InvalidTaskRevisionError(value);
    }

    return new TaskRevision(value);
  }

  static first(): TaskRevision {
    return new TaskRevision(0);
  }

  next(): TaskRevision {
    return new TaskRevision(this.value + 1);
  }

  equals(other: TaskRevision): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
