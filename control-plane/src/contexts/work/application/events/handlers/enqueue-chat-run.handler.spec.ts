import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { EnqueueChatRun } from '@work/application/events/handlers/enqueue-chat-run.handler';
import type { DispatchChat } from '@work/application/services/dispatch-chat.service';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { ChatDispatched } from '@work/domain/events/chat-dispatched.event';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { describe, expect, it, vi } from 'vitest';

const RUN = RunId.of('run_1');
const HANDED = [MessagePosition.of(1)];
const CHAT = ChatId.of('chat_1');

const chatWithRun = (runId: RunId | null) => {
  const released = { currentRunId: null } as unknown as Chat;
  return {
    currentRunId: runId,
    runKeptNothing: vi.fn(() => released),
    released,
  };
};

const enqueuing = (
  over: {
    runId?: RunId | null;
    existing?: Run | null;
    enqueued?: boolean;
  } = {},
) => {
  const chat = chatWithRun(over.runId === undefined ? RUN : over.runId);
  const save = vi.fn(async (_: Chat) => {});
  const enqueue = vi.fn(async () => over.enqueued ?? true);
  const handler = new EnqueueChatRun(
    { find: async () => chat, save } as unknown as ChatRepository,
    { findById: async () => over.existing ?? null } as unknown as RunRepository,
    { enqueue } as unknown as DispatchChat,
  );

  return { handler, chat, save, enqueue };
};

describe('EnqueueChatRun', () => {
  it('enqueues the run a chat was dispatched to', async () => {
    const { handler, chat, enqueue } = enqueuing();

    await handler.on(new ChatDispatched(CHAT, RUN, HANDED));

    expect(enqueue).toHaveBeenCalledWith(chat, RUN, HANDED);
  });

  it('enqueues nothing for a chat since dispatched elsewhere, or twice', async () => {
    const elsewhere = enqueuing({ runId: RunId.of('run_2') });
    await elsewhere.handler.on(new ChatDispatched(CHAT, RUN, HANDED));
    expect(elsewhere.enqueue).not.toHaveBeenCalled();

    const twice = enqueuing({ existing: {} as Run });
    await twice.handler.on(new ChatDispatched(CHAT, RUN, HANDED));
    expect(twice.enqueue).not.toHaveBeenCalled();
  });

  it('detaches the chat from its run and takes back what it handed when its run can no longer start', async () => {
    const { handler, chat, save } = enqueuing({ enqueued: false });

    await handler.on(new ChatDispatched(CHAT, RUN, HANDED));

    expect(chat.runKeptNothing).toHaveBeenCalledWith(RUN);
    expect(save).toHaveBeenCalledWith(chat.released);
  });
});
