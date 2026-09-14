import { InvalidConversationIdError } from '@domain/exceptions/invalid-conversation-id.error';
import { NotePosition } from '@domain/value-objects/note-position.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';

const AT = ':';

export class ConversationId {
  private constructor(
    readonly taskId: TaskId,
    readonly from: NotePosition,
  ) {}

  static of(input: { taskId: TaskId; from: number }): ConversationId {
    try {
      return new ConversationId(input.taskId, NotePosition.of(input.from));
    } catch {
      throw new InvalidConversationIdError(
        `${input.taskId.value}${AT}${input.from}`,
      );
    }
  }

  // Task ids are opaque and may contain the separator, so split from the end.
  static parse(value: string): ConversationId {
    const at = value.lastIndexOf(AT);

    if (at <= 0) {
      throw new InvalidConversationIdError(value);
    }

    try {
      return new ConversationId(
        TaskId.of(value.slice(0, at)),
        NotePosition.of(Number(value.slice(at + 1))),
      );
    } catch {
      throw new InvalidConversationIdError(value);
    }
  }

  get value(): string {
    return `${this.taskId.value}${AT}${this.from.value}`;
  }

  equals(other: ConversationId): boolean {
    return this.taskId.equals(other.taskId) && this.from.equals(other.from);
  }
}
