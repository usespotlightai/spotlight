import type { RunJournalReadingsPort } from '@runs/application/ports/run-journal-readings.port';
import type { RunEndedIntegrationEvent } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import type { BindableChatEvent } from '@work/application/contracts/bindable-chat-events.contract';
import type { ListedProposal } from '@work/application/contracts/listed-proposal.contract';
import type { ChannelNoticesPort } from '@work/application/ports/channel-notices.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import { ChannelReplies } from '@work/application/rendering/channel-replies';
import {
  RunEndedFacts,
  type RunEndingReactions,
} from '@work/application/services/run-ending-reactions';
import { WorkRequesters } from '@work/application/services/work-requesters';
import type {
  Chat,
  NumberedProposal,
} from '@work/domain/aggregates/chat.aggregate';
import type { ChatDispatched } from '@work/domain/events/chat-dispatched.event';
import type { ChatRunNotStarted } from '@work/domain/events/chat-run-not-started.event';
import type { ChatStarted } from '@work/domain/events/chat-started.event';
import type { ProposalDismissed } from '@work/domain/events/proposal-dismissed.event';
import type { TaskOpened } from '@work/domain/events/task-opened.event';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';

export class NotifyChannel implements RunEndingReactions {
  constructor(
    private readonly chats: ChatRepository,
    private readonly lines: LineMapsPort,
    private readonly notices: ChannelNoticesPort,
    private readonly journals: RunJournalReaderPort,
    private readonly readings: RunJournalReadingsPort,
  ) {}

  async onChatStarted(event: ChatStarted): Promise<void> {
    const chat = await this.fromChannel(event.chatId);

    if (chat) {
      await this.post(chat, 'chat.started', '');
    }
  }

  async onChatDispatched(event: ChatDispatched): Promise<void> {
    const chat = await this.fromChannel(event.chatId);

    if (chat) {
      await this.post(chat, 'chat.dispatched', '');
    }
  }

  async onRunEnded(event: RunEndedIntegrationEvent): Promise<void> {
    if (event.ending === 'completed') {
      await this.completed(event);
    }

    if (event.ending === 'exhausted') {
      await this.exhausted(event);
    }
  }

  private async completed(event: RunEndedIntegrationEvent): Promise<void> {
    const chat = await this.fromChannel(WorkRequesters.chatOf(event.requester));

    if (!chat) {
      return;
    }

    const proposals = await this.listed(chat.openProposals);
    const lastWords =
      event.reported && !event.report
        ? this.readings.lastWordsIn(
            await this.journals.attemptsOfRun(RunEndedFacts.runId(event)),
            null,
          )
        : null;
    const body = ChannelReplies.answered(lastWords?.trim() || null, proposals);

    if (body) {
      await this.post(chat, 'chat.replied', body, null, proposals);
    }
  }

  private async exhausted(event: RunEndedIntegrationEvent): Promise<void> {
    const chat = await this.fromChannel(WorkRequesters.chatOf(event.requester));

    if (chat) {
      await this.post(chat, 'chat.replied', ChannelReplies.failed);
    }
  }

  async onRunNotStarted(event: ChatRunNotStarted): Promise<void> {
    const chat = await this.fromChannel(event.chatId);

    if (chat) {
      await this.post(chat, 'chat.replied', ChannelReplies.failed);
    }
  }

  async onTaskOpened(event: TaskOpened): Promise<void> {
    const chat = event.proposedIn
      ? await this.fromChannel(event.proposedIn.chatId)
      : null;

    if (!chat || !event.proposedIn) {
      return;
    }

    const proposal = chat.proposalAt(event.proposedIn.position);

    await this.post(
      chat,
      'chat.replied',
      ChannelReplies.created(proposal.title.value),
      event.taskId.value,
    );
  }

  async onProposalDismissed(event: ProposalDismissed): Promise<void> {
    const chat = await this.fromChannel(event.chatId);

    if (chat) {
      await this.post(
        chat,
        'chat.replied',
        ChannelReplies.dismissed(chat.proposalAt(event.position).title.value),
      );
    }
  }

  private async fromChannel(chatId: ChatId | null): Promise<Chat | null> {
    const chat = chatId ? await this.chats.find(chatId) : null;

    return chat?.fromChannel ? chat : null;
  }

  private async listed(
    open: readonly NumberedProposal[],
  ): Promise<readonly ListedProposal[]> {
    const listed: ListedProposal[] = [];

    for (const { number, proposal } of open) {
      const line = await this.lines.find(proposal.placement.lineId);
      const station = line?.stationAt(proposal.placement.stationId);

      listed.push({
        number,
        title: proposal.title.value,
        line: line?.name.value ?? null,
        station: station?.name.value ?? null,
      });
    }

    return listed;
  }

  private async post(
    chat: Chat,
    event: BindableChatEvent,
    body: string,
    taskId: string | null = null,
    proposals: readonly ListedProposal[] = [],
  ): Promise<void> {
    await this.notices.notify(
      {
        workspaceId: chat.workspaceId.value,
        teamId: chat.teamId.value,
        marks: chat.marks.map((each) => ({
          kind: each.mark.kind,
          value: each.mark.value,
        })),
        body,
        proposals,
        chatId: chat.id.value,
        taskId,
      },
      event,
    );
  }
}
