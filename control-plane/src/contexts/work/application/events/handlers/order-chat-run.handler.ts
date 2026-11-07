import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RunOrdersMapper } from '@work/application/mappers/run-orders.mapper';
import type { DispatchChat } from '@work/application/services/dispatch-chat.service';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import type { ChatRunAssigned } from '@work/domain/events/chat-run-assigned.event';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';

export class OrderChatRun {
  constructor(
    private readonly chats: ChatRepository,
    private readonly dispatches: DispatchRepository,
    private readonly dispatching: DispatchChat,
    private readonly clock: ClockPort,
  ) {}

  async on(event: ChatRunAssigned): Promise<void> {
    const chat = await this.chats.find(event.chatId);

    if (!chat?.hasCurrentRun(event.runId)) {
      return;
    }

    if (await this.dispatches.find(event.runId)) {
      return;
    }

    const ordered = await this.dispatching.ordered(
      chat,
      event.runId,
      event.acknowledged,
    );
    const ordering = {
      id: event.runId,
      workspaceId: chat.workspaceId,
      teamId: chat.teamId,
      subject: { kind: 'chat' as const, chatId: chat.id },
      configuredAs: null,
      briefing: ordered?.order.spec.briefing ?? null,
      briefedMemories: ordered?.briefedMemories,
      now: this.clock.now(),
    };

    await this.dispatches.add(
      ordered
        ? Dispatch.ordered({
            ...ordering,
            order: RunOrdersMapper.toDispatchOrder(ordered.order),
          })
        : Dispatch.unorderable(ordering),
    );
  }
}
