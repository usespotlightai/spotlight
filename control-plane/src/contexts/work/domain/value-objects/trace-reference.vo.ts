import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { InvalidChatMessageError } from '@work/domain/exceptions/invalid-chat-message.error';
import type { TaskTitle } from '@work/domain/value-objects/task-title.vo';

const MAX_AT_ONCE = 20;

export class TraceReference {
  private constructor(
    readonly taskId: TaskId,
    readonly title: TaskTitle,
    readonly teamId: TeamId,
  ) {}

  static of(input: {
    taskId: TaskId;
    title: TaskTitle;
    teamId: TeamId;
  }): TraceReference {
    return new TraceReference(input.taskId, input.title, input.teamId);
  }

  static refuseTooMany(count: number): void {
    if (count > MAX_AT_ONCE) {
      throw new InvalidChatMessageError(
        `can share at most ${MAX_AT_ONCE} traces`,
      );
    }
  }

  static distinct(
    traces: readonly TraceReference[],
  ): readonly TraceReference[] {
    const kept = traces.filter(
      (each, at) => traces.findIndex((other) => other.equals(each)) === at,
    );

    TraceReference.refuseTooMany(kept.length);

    return kept;
  }

  equals(other: TraceReference): boolean {
    return this.taskId.equals(other.taskId);
  }
}
