import type { SandboxRetirementPort } from '@runners/application/ports/sandbox-retirement.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RetireChatSandbox } from '@work/application/events/handlers/retire-chat-sandbox.handler';
import { WorkRequesters } from '@work/application/services/work-requesters';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import { ChatResolved } from '@work/domain/events/chat-resolved.event';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { describe, expect, it, vi } from 'vitest';

const CHAT = ChatId.of('chat_1');

const WORKSPACE = WorkspaceId.of('ws_1');

const KEY = WorkRequesters.chatWorkingCopyKey(CHAT);

const resolved = new ChatResolved(
  CHAT,
  WORKSPACE,
  UserId.of('user_1'),
  new Date('2026-11-26T10:00:00.000Z'),
);

const retiring = (
  chat: { keepsNoLiveWorkingCopy: boolean } | null,
): { handler: RetireChatSandbox; sandboxes: SandboxRetirementPort } => {
  const chats = {
    find: vi.fn(async () => chat as Chat | null),
  } as unknown as ChatRepository;
  const sandboxes: SandboxRetirementPort = { retire: vi.fn(async () => {}) };

  return { handler: new RetireChatSandbox(chats, sandboxes), sandboxes };
};

describe('RetireChatSandbox', () => {
  it('retires the sandbox of a resolved chat with no run in progress', async () => {
    const { handler, sandboxes } = retiring({ keepsNoLiveWorkingCopy: true });

    await handler.on(resolved);

    expect(sandboxes.retire).toHaveBeenCalledWith(WORKSPACE.value, KEY);
  });

  it('keeps the sandbox of a chat that is open again or still runs', async () => {
    const { handler, sandboxes } = retiring({ keepsNoLiveWorkingCopy: false });

    await handler.on(resolved);

    expect(sandboxes.retire).not.toHaveBeenCalled();
  });

  it('retires the sandbox of a deleted chat', async () => {
    const { handler, sandboxes } = retiring(null);

    await handler.on(resolved);

    expect(sandboxes.retire).toHaveBeenCalledWith(WORKSPACE.value, KEY);
  });
});
