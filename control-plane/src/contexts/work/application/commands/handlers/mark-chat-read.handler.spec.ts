import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { MarkChatReadCommand } from '@work/application/commands/chat.commands';
import { MarkChatReadHandler } from '@work/application/commands/handlers/mark-chat-read.handler';
import { ChatLoader } from '@work/application/services/chat-loader.service';
import { workAccessSeeing } from '@work/application/services/work-access.fake-spec';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
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
  })
    .assignRun(RunId.of('run_1'), new Date('2026-10-11T08:00:00.000Z'))
    .propose({
      runId: RunId.of('run_1'),
      placement: ProposalPlacement.of({
        lineId: LineId.of('line_1'),
        stationId: StationId.of('station_1'),
      }),
      title: TaskTitle.of('Back off exponentially'),
      description: null,
      at: new Date('2026-10-11T08:30:00.000Z'),
    });

const handling = (
  chat: Chat | null,
  access: WorkAccess = workAccessSeeing(() => true),
) => {
  const saved: Chat[] = [];
  const debug = vi.fn();
  const chats = {
    find: vi.fn(async () => chat),
    save: vi.fn(async (each: Chat) => {
      saved.push(each);
    }),
  } as unknown as ChatRepository;
  const handler = new MarkChatReadHandler(
    new ChatLoader(chats, access),
    chats,
    clock,
    { debug } as unknown as LoggerPort,
  );

  return { handler, saved, debug };
};

describe('MarkChatReadHandler', () => {
  it('saves nothing for a chat with no proposal since it was last read', async () => {
    const { handler, saved } = handling(
      chatOf().markRead(UserId.of('user_1'), NOW),
    );

    await handler.execute(new MarkChatReadCommand('chat_1', 'acme', 'user_1'));

    expect(saved).toEqual([]);
  });

  it('marks the chat read and logs it', async () => {
    const { handler, saved, debug } = handling(chatOf());

    await handler.execute(new MarkChatReadCommand('chat_1', 'acme', 'user_1'));

    expect(saved[0]?.readAt).toEqual(NOW);
    expect(debug).toHaveBeenCalledWith(
      { chatId: 'chat_1', action: 'read' },
      expect.any(String),
    );
  });

  it('knows no chat that somebody else started', async () => {
    const { handler, saved } = handling(chatOf());

    await expect(
      handler.execute(new MarkChatReadCommand('chat_1', 'acme', 'user_2')),
    ).rejects.toBeInstanceOf(ApplicationError);
    expect(saved).toEqual([]);
  });

  it('knows no chat that does not exist', async () => {
    const { handler } = handling(null);

    await expect(
      handler.execute(new MarkChatReadCommand('chat_9', 'acme', 'user_1')),
    ).rejects.toBeInstanceOf(ApplicationError);
  });
  it('knows no chat in another workspace than the one the caller names', async () => {
    const { handler, saved } = handling(chatOf());

    await expect(
      handler.execute(new MarkChatReadCommand('chat_1', 'globex', 'user_1')),
    ).rejects.toMatchObject({ kind: 'not-found' });
    expect(saved).toEqual([]);
  });

  it('knows no chat for its starter once they left the workspace', async () => {
    const { handler, saved } = handling(
      chatOf(),
      workAccessSeeing(() => false),
    );

    await expect(
      handler.execute(new MarkChatReadCommand('chat_1', 'acme', 'user_1')),
    ).rejects.toMatchObject({ kind: 'not-found' });
    expect(saved).toEqual([]);
  });
});
