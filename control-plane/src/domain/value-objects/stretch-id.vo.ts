import { InvalidStretchIdError } from '@domain/exceptions/invalid-stretch-id.error';
import { TaskId } from '@domain/value-objects/task-id.vo';

const AT = ':';

/** A task can need someone more than once, so it takes the note as well. */
export class StretchId {
  private constructor(
    readonly taskId: TaskId,
    readonly from: number,
  ) {}

  static of(input: { taskId: TaskId; from: number }): StretchId {
    if (!Number.isInteger(input.from) || input.from < 0) {
      throw new InvalidStretchIdError(
        `${input.taskId.value}${AT}${input.from}`,
      );
    }

    return new StretchId(input.taskId, input.from);
  }

  // A task id is opaque, so the note comes off the end.
  static parse(value: string): StretchId {
    const at = value.lastIndexOf(AT);

    if (at <= 0) {
      throw new InvalidStretchIdError(value);
    }

    const from = Number(value.slice(at + 1));

    if (!Number.isInteger(from) || from < 0) {
      throw new InvalidStretchIdError(value);
    }

    return new StretchId(TaskId.of(value.slice(0, at)), from);
  }

  get value(): string {
    return `${this.taskId.value}${AT}${this.from}`;
  }

  equals(other: StretchId): boolean {
    return this.taskId.equals(other.taskId) && this.from === other.from;
  }
}
