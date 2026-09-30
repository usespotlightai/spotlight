import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it } from 'vitest';

const cases = {
  task: (taskId: TaskId, stationId: StationId | null) =>
    `task ${taskId.value} at ${stationId?.value ?? 'nowhere'}`,
  chat: (chatId: ChatId) => `chat ${chatId.value}`,
};

describe('RunSubject', () => {
  it('works a task at a station, or a chat, and says which', () => {
    expect(
      RunSubject.task(
        TaskId.of('task_1'),
        StationId.of('station_1'),
        TaskRevision.of(0),
      ).match(cases),
    ).toBe('task task_1 at station_1');
    expect(RunSubject.chat(ChatId.of('chat_1')).match(cases)).toBe(
      'chat chat_1',
    );
  });

  it('keeps a workspace for its task, wherever the task stands, or for its chat', () => {
    expect(
      RunSubject.task(
        TaskId.of('task_1'),
        StationId.of('station_1'),
        TaskRevision.of(0),
      ).archiveHolder,
    ).toEqual({ kind: 'task', taskId: TaskId.of('task_1') });
    expect(
      RunSubject.task(TaskId.of('task_1'), null, TaskRevision.of(0))
        .archiveHolder,
    ).toEqual({ kind: 'task', taskId: TaskId.of('task_1') });
    expect(RunSubject.chat(ChatId.of('chat_1')).archiveHolder).toEqual({
      kind: 'chat',
      chatId: ChatId.of('chat_1'),
    });
  });

  it('comes back as what it was stored as', () => {
    const subject = RunSubject.rehydrate({
      taskId: TaskId.of('task_1'),
      stationId: null,
      chatId: null,
      revision: TaskRevision.of(0),
    });

    expect(
      subject?.equals(
        RunSubject.task(TaskId.of('task_1'), null, TaskRevision.of(0)),
      ),
    ).toBe(true);
    expect(
      RunSubject.rehydrate({
        taskId: null,
        stationId: null,
        chatId: null,
        revision: null,
      }),
    ).toBeNull();
  });

  it('never works a task and a chat at once', () => {
    expect(() =>
      RunSubject.rehydrate({
        taskId: TaskId.of('task_1'),
        stationId: null,
        chatId: ChatId.of('chat_1'),
        revision: null,
      }),
    ).toThrow(InconsistentStateError);
  });

  it('never stands at a station with no task', () => {
    expect(() =>
      RunSubject.rehydrate({
        taskId: null,
        stationId: StationId.of('station_1'),
        chatId: null,
        revision: null,
      }),
    ).toThrow(InconsistentStateError);
  });

  it('refuses a task subject that does not say which revision it was handed', () => {
    expect(() =>
      RunSubject.rehydrate({
        taskId: TaskId.of('task_1'),
        stationId: null,
        chatId: null,
        revision: null,
      }),
    ).toThrow(InconsistentStateError);
  });
});
