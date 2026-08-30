import { InvalidConversationIdError } from '@domain/exceptions/invalid-conversation-id.error';
import { TaskId } from '@domain/value-objects/task-id.vo';

const AT = ':';

/** A task can need someone more than once, so it takes the note as well. */
export class ConversationId {
  private constructor(
    readonly taskId: TaskId,
    readonly from: number,
  ) {}

  static of(input: { taskId: TaskId; from: number }): ConversationId {
    if (!Number.isInteger(input.from) || input.from < 0) {
      throw new InvalidConversationIdError(
        `${input.taskId.value}${AT}${input.from}`,
      );
    }

    return new ConversationId(input.taskId, input.from);
  }

  // A task id is opaque, so the note comes off the end.
  static parse(value: string): ConversationId {
    const at = value.lastIndexOf(AT);

    if (at <= 0) {
      throw new InvalidConversationIdError(value);
    }

    const from = Number(value.slice(at + 1));

    if (!Number.isInteger(from) || from < 0) {
      throw new InvalidConversationIdError(value);
    }

    return new ConversationId(TaskId.of(value.slice(0, at)), from);
  }

  get value(): string {
    return `${this.taskId.value}${AT}${this.from}`;
  }

  equals(other: ConversationId): boolean {
    return this.taskId.equals(other.taskId) && this.from === other.from;
  }
}
