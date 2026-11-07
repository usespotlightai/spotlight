import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkRequesters } from '@work/application/services/work-requesters';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

describe('WorkRequesters', () => {
  it('names a task run by its task and the revision it was dispatched at', () => {
    const requester = WorkRequesters.task(
      TaskId.of('task_1'),
      TaskRevision.of(3),
      TEAM,
    );

    expect(requester).toEqual({
      owner: 'work',
      kind: 'task',
      id: 'task_1',
      token: '3',
      team: 'team_1',
    });
    expect(WorkRequesters.decode(requester)).toEqual({
      task: TaskId.of('task_1'),
      revision: TaskRevision.of(3),
    });
  });

  it('names a chat run by its chat', () => {
    const requester = WorkRequesters.chat(ChatId.of('chat_1'), TEAM);

    expect(WorkRequesters.decode(requester)).toEqual({
      chat: ChatId.of('chat_1'),
    });
    expect(WorkRequesters.chatOf(requester)?.value).toBe('chat_1');
    expect(WorkRequesters.taskOf(requester)).toBeNull();
  });

  it('decodes nothing it did not request', () => {
    expect(
      WorkRequesters.decode({
        owner: 'replays',
        kind: 'task',
        id: 'task_1',
        token: '0',
      }),
    ).toBeNull();
    expect(
      WorkRequesters.decode({
        owner: 'work',
        kind: 'task',
        id: 'task_1',
        token: null,
      }),
    ).toBeNull();
    expect(
      WorkRequesters.decode({
        owner: 'work',
        kind: 'trial',
        id: 'run_1',
        token: null,
      }),
    ).toBeNull();
  });

  it('gives every run of a task, at any station, the one working copy of that task', () => {
    expect(WorkRequesters.taskWorkingCopy(TaskId.of('task_1'))).toEqual({
      key: 'work/task-task_1',
      rejoinable: true,
      restores: 'always',
    });
    expect(WorkRequesters.chatWorkingCopy(ChatId.of('chat_1'))).toEqual({
      key: 'work/chat-chat_1',
      rejoinable: true,
      restores: 'when-continuing',
    });
  });

  it('knows which task or chat holds a working copy it named', () => {
    expect(WorkRequesters.heldBy('task-task_1')).toEqual({
      task: TaskId.of('task_1'),
    });
    expect(WorkRequesters.heldBy('chat-chat_1')).toEqual({
      chat: ChatId.of('chat_1'),
    });
    expect(WorkRequesters.heldBy('scratch')).toBeNull();
  });
});
