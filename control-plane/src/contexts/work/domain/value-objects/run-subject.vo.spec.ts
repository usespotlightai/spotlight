import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it } from 'vitest';

const cases = {
  task: (taskId: TaskId, stationId: StationId | null) =>
    `task ${taskId.value} at ${stationId?.value ?? 'nowhere'}`,
  chat: (chatId: ChatId) => `chat ${chatId.value}`,
  replay: (original: RunId, taskId: TaskId, stationId: StationId | null) =>
    `replay of ${original.value} (task ${taskId.value}) at ${stationId?.value ?? 'nowhere'}`,
};

const aReplay = () =>
  RunSubject.replay(
    RunId.of('run_1'),
    TaskId.of('task_1'),
    StationId.of('station_1'),
    TeamId.of('team_1'),
  );

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

  it('replays a run of a task at a station without working the task itself', () => {
    const replay = aReplay();

    expect(replay.match(cases)).toBe(
      'replay of run_1 (task task_1) at station_1',
    );
    expect(replay.isReplay).toBe(true);
    expect(replay.taskId).toBeNull();
    expect(replay.chatId).toBeNull();
    expect(replay.archiveHolder).toBeNull();
    expect(
      RunSubject.task(
        TaskId.of('task_1'),
        StationId.of('station_1'),
        TaskRevision.of(0),
      ).isReplay,
    ).toBe(false);
  });

  it('comes back as the replay it was stored as', () => {
    const subject = RunSubject.rehydrate({
      taskId: null,
      stationId: StationId.of('station_1'),
      chatId: null,
      revision: null,
      replayOf: RunId.of('run_1'),
      replayedTaskId: TaskId.of('task_1'),
      replayedFor: TeamId.of('team_1'),
    });

    expect(subject?.equals(aReplay())).toBe(true);
    expect(() =>
      RunSubject.rehydrate({
        taskId: null,
        stationId: null,
        chatId: null,
        revision: null,
        replayOf: RunId.of('run_1'),
        replayedTaskId: TaskId.of('task_1'),
      }),
    ).toThrow(InconsistentStateError);
    expect(
      subject?.equals(
        RunSubject.replay(
          RunId.of('run_2'),
          TaskId.of('task_1'),
          StationId.of('station_1'),
          TeamId.of('team_1'),
        ),
      ),
    ).toBe(false);
  });

  it('never replays a run while working a task or chat of its own, or without naming the task', () => {
    for (const stored of [
      {
        taskId: TaskId.of('task_1'),
        revision: TaskRevision.of(0),
        chatId: null,
        replayedTaskId: TaskId.of('task_1'),
      },
      {
        taskId: null,
        revision: null,
        chatId: ChatId.of('chat_1'),
        replayedTaskId: TaskId.of('task_1'),
      },
      { taskId: null, revision: null, chatId: null, replayedTaskId: null },
    ]) {
      expect(() =>
        RunSubject.rehydrate({
          ...stored,
          stationId: null,
          replayOf: RunId.of('run_1'),
        }),
      ).toThrow(InconsistentStateError);
    }
  });
});
