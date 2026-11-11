import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ResolveChatCommand } from '@work/application/commands/chat.commands';
import { ResolveChatHandler } from '@work/application/commands/handlers/resolve-chat.handler';
import { ChatLoader } from '@work/application/services/chat-loader.service';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-10-11T09:00:00.000Z');
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };

const chatOf = () =>
  Chat.start({
    lines: [],
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('claude-code'),
    body: ChatMessageBody.of('Plan the retries.'),
    now: new Date('2026-10-11T08:00:00.000Z'),
    newId: () => 'chat_1',
  });

const handling = (chat: Chat | null) => {
  const saved: Chat[] = [];
  const debug = vi.fn();
  const chats = {
    find: vi.fn(async () => chat),
    save: vi.fn(async (each: Chat) => {
      saved.push(each);
    }),
  } as unknown as ChatRepository;
  const handler = new ResolveChatHandler(
    new ChatLoader(chats, {} as WorkAccess),
    chats,
    clock,
    { debug } as unknown as LoggerPort,
  );

  return { handler, saved, debug };
};

describe('ResolveChatHandler', () => {
  it('resolves the chat and logs it', async () => {
    const { handler, saved, debug } = handling(chatOf());

    await handler.execute(new ResolveChatCommand('chat_1', 'user_1'));

    expect(saved[0]?.resolvedAt).toEqual(NOW);
    expect(debug).toHaveBeenCalledWith(
      { chatId: 'chat_1', action: 'resolve' },
      expect.any(String),
    );
  });

  it('saves nothing for a chat that is resolved already', async () => {
    const { handler, saved, debug } = handling(
      chatOf().resolve(UserId.of('user_1'), NOW),
    );

    await handler.execute(new ResolveChatCommand('chat_1', 'user_1'));

    expect(saved).toEqual([]);
    expect(debug).not.toHaveBeenCalled();
  });

  it('knows no chat that somebody else started', async () => {
    const { handler, saved } = handling(chatOf());

    await expect(
      handler.execute(new ResolveChatCommand('chat_1', 'user_2')),
    ).rejects.toBeInstanceOf(ApplicationError);
    expect(saved).toEqual([]);
  });

  it('knows no chat that does not exist', async () => {
    const { handler } = handling(null);

    await expect(
      handler.execute(new ResolveChatCommand('chat_9', 'user_1')),
    ).rejects.toBeInstanceOf(ApplicationError);
  });
});
