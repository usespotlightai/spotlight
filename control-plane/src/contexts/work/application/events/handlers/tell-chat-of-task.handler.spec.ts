import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { TellChatOfTask } from '@work/application/events/handlers/tell-chat-of-task.handler';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { TaskNotedForChat } from '@work/domain/events/task-noted-for-chat.event';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-19T09:00:00.000Z');

const idle = () =>
  Chat.start({
    lines: [],
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('claude-code'),
    body: ChatMessageBody.of('Show icons for videos.'),
    now: NOW,
    newId: () => 'chat_1',
  })
    .assignRun(RunId.of('run_1'), NOW)
    .runEnded(RunId.of('run_1'), {
      session: HarnessSession.of('session_1'),
      claimedBy: null,
      lastWordsAt: null,
      endedAt: NOW,
    }).chat;

const word = (wakes: boolean, body = 'Checks failed on web.') =>
  new TaskNotedForChat(
    TaskId.of('task_1'),
    WorkspaceId.of('ws_1'),
    ChatId.of('chat_1'),
    body,
    wakes,
    NOW,
  );

const using = (chat: Chat | null) => {
  const saved: Chat[] = [];
  const takenUp = vi.fn(async (each: Chat) =>
    each.assignRun(RunId.of('run_2'), NOW),
  );
  const handler = new TellChatOfTask(
    partial<ChatRepository>({
      find: async () => chat,
      save: async (each: Chat) => {
        saved.push(each);
      },
    }),
    { takenUp },
    partial<TransactionPort>({
      inTransaction: <T>(work: () => Promise<T>) => work(),
    }),
  );

  return { handler, saved, takenUp };
};

describe('TellChatOfTask', () => {
  it('tells the chat what happened and hands it to a run', async () => {
    const { handler, saved, takenUp } = using(idle());

    await handler.on(word(true));

    expect(takenUp).toHaveBeenCalledOnce();
    expect(saved[0]?.running).toBe(true);
    expect(saved[0]?.messages.slice(-1)[0]?.body.value).toBe(
      'Checks failed on web.',
    );
  });

  it('only tells the chat when the word does not wake it', async () => {
    const { handler, saved, takenUp } = using(idle());

    await handler.on(word(false, 'The pull request was merged.'));

    expect(takenUp).not.toHaveBeenCalled();
    expect(saved[0]?.messages.slice(-1)[0]?.kind).toBe('happened');
  });

  it('cuts a long word to what a message can hold', async () => {
    const { handler, saved } = using(idle());

    await handler.on(word(false, 'x'.repeat(30_000)));

    expect(saved[0]?.messages.slice(-1)[0]?.body.value.length).toBeLessThan(
      30_000,
    );
  });

  it('does nothing for a chat that is gone', async () => {
    const { handler, saved } = using(null);

    await handler.on(word(true));

    expect(saved).toEqual([]);
  });
});
