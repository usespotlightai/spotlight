import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { SendChatMessageCommand } from '@work/application/commands/chat.commands';
import { SendChatMessageHandler } from '@work/application/commands/handlers/send-chat-message.handler';
import type { ChatDispatching } from '@work/application/services/chat-dispatch';
import type { ChatLoader } from '@work/application/services/chat-loader.service';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import type { TracesLoader } from '@work/application/services/traces-loader.service';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { Effort } from '@work/domain/value-objects/effort.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-03T09:00:00.000Z');

const chatOnOpus = () =>
  Chat.start({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('claude-code'),
    model: HarnessModel.of('opus'),
    effort: Effort.of('high'),
    body: ChatMessageBody.given('Plan the retries.'),
    now: NOW,
    newId: () => 'chat_1',
  });

const sendMessage = async (model?: string | null, effort?: string | null) => {
  const saved: Chat[] = [];

  await new SendChatMessageHandler(
    { inTeam: async () => chatOnOpus() } as unknown as ChatLoader,
    {
      save: async (chat: Chat) => {
        saved.push(chat);
      },
    } as unknown as ChatRepository,
    {
      handedOver: async () => [],
      takenIn: async () => undefined,
    } as unknown as FilesLoader,
    { shared: async () => [] } as unknown as TracesLoader,
    { takenUp: async (chat: Chat) => chat } as unknown as ChatDispatching,
    { now: () => NOW } as ClockPort,
    { inTransaction: (work: () => Promise<void>) => work() } as TransactionPort,
  ).execute(
    new SendChatMessageCommand(
      'team_1',
      'chat_1',
      'user_1',
      'Think harder.',
      [],
      [],
      model,
      effort,
    ),
  );

  const [chat] = saved;
  return {
    model: chat?.model?.value ?? null,
    effort: chat?.effort?.value ?? null,
  };
};

describe('SendChatMessageHandler', () => {
  it('keeps the chat’s model and effort where the message names none', async () => {
    expect(await sendMessage()).toEqual({ model: 'opus', effort: 'high' });
  });

  it('goes back to the harness default where the message says null', async () => {
    expect(await sendMessage(null, null)).toEqual({
      model: null,
      effort: null,
    });
  });

  it('answers with the model and effort the message picks', async () => {
    expect(await sendMessage('sonnet', 'low')).toEqual({
      model: 'sonnet',
      effort: 'low',
    });
  });

  it('rejects an empty model or an effort that is no level at all', async () => {
    await expect(sendMessage('')).rejects.toMatchObject({ kind: 'invalid' });
    await expect(sendMessage(undefined, 'enormous')).rejects.toMatchObject({
      kind: 'invalid',
    });
  });
});
