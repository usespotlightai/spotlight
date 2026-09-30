import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { ArchiveHolder } from '@work/domain/value-objects/archive-holder.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { TaskRevision } from '@work/domain/value-objects/task-revision.vo';

export interface RunSubjectCases<T> {
  task(taskId: TaskId, stationId: StationId | null, revision: TaskRevision): T;
  chat(chatId: ChatId): T;
}

export class RunSubject {
  private constructor(
    readonly taskId: TaskId | null,
    readonly stationId: StationId | null,
    readonly chatId: ChatId | null,
    readonly revision: TaskRevision | null,
  ) {}

  static task(
    taskId: TaskId,
    stationId: StationId | null,
    revision: TaskRevision,
  ): RunSubject {
    return new RunSubject(taskId, stationId, null, revision);
  }

  static chat(chatId: ChatId): RunSubject {
    return new RunSubject(null, null, chatId, null);
  }

  static rehydrate(input: {
    taskId: TaskId | null;
    stationId: StationId | null;
    chatId: ChatId | null;
    revision: TaskRevision | null;
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
    if (input.taskId && input.revision === null) {
      throw new InconsistentStateError(
        'run',
        'works a task without the revision it was handed',
      );
    }
    if (input.taskId && input.revision) {
      return RunSubject.task(input.taskId, input.stationId, input.revision);
    }
    if (input.stationId) {
      throw new InconsistentStateError(
        'run',
        'stands at a station with no task',
      );
    }

    return null;
  }

  get archiveHolder(): ArchiveHolder | null {
    if (this.chatId) {
      return { kind: 'chat', chatId: this.chatId };
    }

    return this.taskId ? { kind: 'task', taskId: this.taskId } : null;
  }

  match<T>(cases: RunSubjectCases<T>): T {
    return this.chatId
      ? cases.chat(this.chatId)
      : cases.task(
          this.taskId as TaskId,
          this.stationId,
          this.revision as TaskRevision,
        );
  }

  equals(other: RunSubject): boolean {
    const same = <V extends { equals(other: V): boolean }>(
      a: V | null,
      b: V | null,
    ): boolean => (a === null ? b === null : b !== null && a.equals(b));

    return (
      same(this.taskId, other.taskId) &&
      same(this.stationId, other.stationId) &&
      same(this.chatId, other.chatId) &&
      same(this.revision, other.revision)
    );
  }
}
