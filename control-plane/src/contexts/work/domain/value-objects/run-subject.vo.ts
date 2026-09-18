import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

export interface RunSubjectCases<T> {
  task(taskId: TaskId, stationId: StationId | null): T;
  chat(chatId: ChatId): T;
}

export class RunSubject {
  private constructor(
    readonly taskId: TaskId | null,
    readonly stationId: StationId | null,
    readonly chatId: ChatId | null,
  ) {}

  static task(taskId: TaskId, stationId: StationId | null): RunSubject {
    return new RunSubject(taskId, stationId, null);
  }

  static chat(chatId: ChatId): RunSubject {
    return new RunSubject(null, null, chatId);
  }

  static rehydrate(input: {
    taskId: TaskId | null;
    stationId: StationId | null;
    chatId: ChatId | null;
  }): RunSubject | null {
    if (input.chatId && (input.taskId || input.stationId)) {
      throw new InconsistentStateError(
        'run',
        'works a chat and a task at once',
      );
    }
    if (input.chatId) {
      return RunSubject.chat(input.chatId);
    }
    if (input.taskId) {
      return RunSubject.task(input.taskId, input.stationId);
    }
    if (input.stationId) {
      throw new InconsistentStateError(
        'run',
        'stands at a station with no task',
      );
    }

    return null;
  }

  match<T>(cases: RunSubjectCases<T>): T {
    return this.chatId
      ? cases.chat(this.chatId)
      : cases.task(this.taskId as TaskId, this.stationId);
  }

  equals(other: RunSubject): boolean {
    const same = <V extends { equals(other: V): boolean }>(
      a: V | null,
      b: V | null,
    ): boolean => (a === null ? b === null : b !== null && a.equals(b));

    return (
      same(this.taskId, other.taskId) &&
      same(this.stationId, other.stationId) &&
      same(this.chatId, other.chatId)
    );
  }
}
