import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { SayInChatCommand } from '@work/application/commands/chat.commands';
import { SayInChatHandler } from '@work/application/commands/handlers/say-in-chat.handler';
import type { ChatAtHand } from '@work/application/services/chat-at-hand.service';
import type { ChatDispatching } from '@work/application/services/chat-dispatch';
import type { FilesAtHand } from '@work/application/services/files-at-hand.service';
import type { TracesAtHand } from '@work/application/services/traces-at-hand.service';
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

const saying = async (model?: string | null, effort?: string | null) => {
  const saved: Chat[] = [];

  await new SayInChatHandler(
    { inTeam: async () => chatOnOpus() } as unknown as ChatAtHand,
    {
      save: async (chat: Chat) => {
        saved.push(chat);
      },
    } as unknown as ChatRepository,
    { handedOver: async () => [] } as unknown as FilesAtHand,
    { shared: async () => [] } as unknown as TracesAtHand,
    { takenUp: async (chat: Chat) => chat } as unknown as ChatDispatching,
    { now: () => NOW } as ClockPort,
    { run: (work: () => Promise<void>) => work() } as TransactionPort,
  ).execute(
    new SayInChatCommand(
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

describe('SayInChatHandler', () => {
  it('keeps the chat’s model and effort where the message names none', async () => {
    expect(await saying()).toEqual({ model: 'opus', effort: 'high' });
  });

  it('goes back to the harness default where the message says null', async () => {
    expect(await saying(null, null)).toEqual({ model: null, effort: null });
  });

  it('answers with the model and effort the message picks', async () => {
    expect(await saying('sonnet', 'low')).toEqual({
      model: 'sonnet',
      effort: 'low',
    });
  });

  it('refuses an empty model or an effort that is no level at all', async () => {
    await expect(saying('')).rejects.toMatchObject({ kind: 'invalid-input' });
    await expect(saying(undefined, 'enormous')).rejects.toMatchObject({
      kind: 'invalid-input',
    });
  });
});
