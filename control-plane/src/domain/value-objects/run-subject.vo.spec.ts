import { InconsistentStateError } from '@domain/exceptions/inconsistent-state.error';
import { ChatId } from '@domain/value-objects/chat-id.vo';
import { RunSubject } from '@domain/value-objects/run-subject.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const cases = {
  task: (taskId: TaskId, stationId: StationId | null) =>
    `task ${taskId.value} at ${stationId?.value ?? 'nowhere'}`,
  chat: (chatId: ChatId) => `chat ${chatId.value}`,
};

describe('RunSubject', () => {
  it('works a task at a station, or a chat, and says which', () => {
    expect(
      RunSubject.task(TaskId.of('task_1'), StationId.of('station_1')).match(
        cases,
      ),
    ).toBe('task task_1 at station_1');
    expect(RunSubject.chat(ChatId.of('chat_1')).match(cases)).toBe(
      'chat chat_1',
    );
  });

  it('comes back as what it was stored as', () => {
    const subject = RunSubject.rehydrate({
      taskId: TaskId.of('task_1'),
      stationId: null,
      chatId: null,
    });

    expect(subject?.equals(RunSubject.task(TaskId.of('task_1'), null))).toBe(
      true,
    );
    expect(
      RunSubject.rehydrate({ taskId: null, stationId: null, chatId: null }),
    ).toBeNull();
  });

  it('never works a task and a chat at once', () => {
    expect(() =>
      RunSubject.rehydrate({
        taskId: TaskId.of('task_1'),
        stationId: null,
        chatId: ChatId.of('chat_1'),
      }),
    ).toThrow(InconsistentStateError);
  });

  it('never stands at a station with no task', () => {
    expect(() =>
      RunSubject.rehydrate({
        taskId: null,
        stationId: StationId.of('station_1'),
        chatId: null,
      }),
    ).toThrow(InconsistentStateError);
  });
});
