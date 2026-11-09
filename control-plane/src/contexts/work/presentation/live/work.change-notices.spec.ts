import { ChangeNotices } from '@platform/live/change-notices';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ChatRunEnded } from '@work/domain/events/chat-run-ended.event';
import { DispatchOrdered } from '@work/domain/events/dispatch-ordered.event';
import { NoticeResolved } from '@work/domain/events/notice-resolved.event';
import { TaskAssigned } from '@work/domain/events/task-assigned.event';
import { TaskNoted } from '@work/domain/events/task-noted.event';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import { WORK_CHANGE_NOTICES } from '@work/presentation/live/work.change-notices';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const noticesOf = (...events: DomainEvent[]) => {
  const notices = new ChangeNotices();
  notices.register(WORK_CHANGE_NOTICES);
  return notices.of(events, (name, error) => {
    throw new Error(`${name} failed: ${String(error)}`);
  });
};

describe('Work change notices', () => {
  it('tells the chat’s starter about the chat, and the workspace about tasks and runs', () => {
    expect(
      noticesOf(
        new ChatRunEnded(
          ChatId.of('chat_1'),
          WORKSPACE,
          UserId.of('user_1'),
          RunId.of('run_1'),
          true,
        ),
        new TaskAssigned(TaskId.of('task_1'), WORKSPACE, UserId.of('user_1')),
        new DispatchOrdered(RunId.of('run_1'), WORKSPACE),
        new TaskNoted(
          TaskId.of('task_2'),
          WORKSPACE,
          NotePosition.of(0),
          'message',
        ),
        new NoticeResolved(
          NoticeId.of('notice_1'),
          WORKSPACE,
          UserId.of('user_1'),
          new Date('2026-11-09T12:00:00.000Z'),
        ),
      ),
    ).toEqual([
      { channel: 'person:user_1', topic: 'chat', ids: { chatId: 'chat_1' } },
      { channel: 'workspace:ws_1', topic: 'task', ids: { taskId: 'task_1' } },
      { channel: 'workspace:ws_1', topic: 'run', ids: { runId: 'run_1' } },
      { channel: 'workspace:ws_1', topic: 'task', ids: { taskId: 'task_2' } },
      { channel: 'workspace:ws_1', topic: 'inbox', ids: {} },
    ]);
  });
});
