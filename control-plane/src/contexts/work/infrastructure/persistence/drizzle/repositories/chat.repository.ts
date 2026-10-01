import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { ChatMessage } from '@work/domain/entities/chat-message.entity';
import { TaskProposal } from '@work/domain/entities/task-proposal.entity';
import { ChatMovedOnError } from '@work/domain/exceptions/chat-moved-on.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ChatTitle } from '@work/domain/value-objects/chat-title.vo';
import { Effort } from '@work/domain/value-objects/effort.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { ImprovedStation } from '@work/domain/value-objects/improved-station.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TraceReference } from '@work/domain/value-objects/trace-reference.vo';
import { claimAttachments } from '@work/infrastructure/persistence/drizzle/attachment-claims';
import {
  chat,
  chatAttachment,
  chatMessage,
  type ProposalRow,
} from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { and, asc, eq } from 'drizzle-orm';

type Row = typeof chat.$inferSelect;
type MessageRow = typeof chatMessage.$inferSelect;
type AttachmentRow = typeof chatAttachment.$inferSelect;

const toProposal = (
  row: ProposalRow | null,
  position: MessagePosition,
): TaskProposal | null =>
  row
    ? TaskProposal.rehydrate({
        position,
        placement: ProposalPlacement.of({
          lineId: LineId.of(row.lineId),
          stationId: StationId.of(row.stationId),
        }),
        title: TaskTitle.of(row.title),
        description: row.description
          ? TaskDescription.of(row.description)
          : null,
        state: row.state,
        taskId: row.taskId ? TaskId.of(row.taskId) : null,
        settledAt: row.settledAt ? new Date(row.settledAt) : null,
      })
    : null;

const fromProposal = (proposal: TaskProposal | null): ProposalRow | null =>
  proposal
    ? {
        lineId: proposal.placement.lineId.value,
        stationId: proposal.placement.stationId.value,
        title: proposal.title.value,
        description: proposal.description?.value ?? null,
        state: proposal.state,
        taskId: proposal.taskId?.value ?? null,
        settledAt: proposal.settledAt?.toISOString() ?? null,
      }
    : null;

const toMessage = (
  row: MessageRow,
  attachments: readonly AttachmentRow[],
): ChatMessage => {
  const position = MessagePosition.of(row.position);

  return ChatMessage.rehydrate({
    position,
    kind: row.kind,
    body: ChatMessageBody.of(row.body),
    at: row.at,
    author: row.authorId ? UserId.of(row.authorId) : null,
    runId: row.runId ? RunId.of(row.runId) : null,
    attachments: attachments
      .filter((each) => each.messagePosition === row.position)
      .sort((a, b) => a.place - b.place)
      .map((each) => Attachment.rehydrate(each)),
    traces: row.traces.map((each) =>
      TraceReference.of({
        taskId: TaskId.of(each.taskId),
        title: TaskTitle.of(each.title),
        teamId: TeamId.of(each.teamId),
      }),
    ),
    proposal: toProposal(row.proposal ?? null, position),
    deliveredAt: row.deliveredAt,
    deliveredTo: row.deliveredTo ? RunId.of(row.deliveredTo) : null,
  });
};

const toChat = (
  row: Row,
  messages: readonly MessageRow[],
  attachments: readonly AttachmentRow[],
): Chat =>
  Chat.rehydrate({
    id: ChatId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    teamId: TeamId.of(row.teamId),
    startedBy: UserId.of(row.startedById),
    title: ChatTitle.of(row.title),
    harness: HarnessId.of(row.harness),
    model: row.model ? HarnessModel.of(row.model) : null,
    effort: row.effort ? Effort.of(row.effort) : null,
    repositories: row.repositories.map((each) => Repository.of(each)),
    improving: row.improving
      ? ImprovedStation.rehydrate({
          teamId: TeamId.of(row.teamId),
          lineId: LineId.of(row.improving.lineId),
          lineKey: LineKey.of(row.improving.lineKey),
          lineName: LineName.of(row.improving.lineName),
          stationId: StationId.of(row.improving.stationId),
          stationKey: StationKey.of(row.improving.stationKey),
          stationName: StationName.of(row.improving.stationName),
        })
      : null,
    messages: messages.map((each) => toMessage(each, attachments)),
    currentRunId: row.currentRunId ? RunId.of(row.currentRunId) : null,
    sessionId: row.sessionId ? HarnessSession.of(row.sessionId) : null,
    runnerId: row.runnerId ? RunnerId.of(row.runnerId) : null,
    createdAt: row.createdAt,
    version: row.version,
  });

@Injectable()
export class DrizzleChatRepository implements ChatRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: Chat): Promise<void> {
    await this.context.run(async () => {
      await this.inserted(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  private async inserted(added: Chat): Promise<void> {
    await this.context.db.insert(chat).values({
      id: added.id.value,
      workspaceId: added.workspaceId.value,
      teamId: added.teamId.value,
      startedById: added.startedBy.value,
      title: added.title.value,
      harness: added.harness.value,
      model: added.model?.value ?? null,
      effort: added.effort?.value ?? null,
      repositories: added.repositories.map((each) => each.value),
      improving: added.improving
        ? {
            lineId: added.improving.lineId.value,
            lineKey: added.improving.lineKey.value,
            lineName: added.improving.lineName.value,
            stationId: added.improving.stationId.value,
            stationKey: added.improving.stationKey.value,
            stationName: added.improving.stationName.value,
          }
        : null,
      currentRunId: added.currentRunId?.value ?? null,
      sessionId: added.sessionId?.value ?? null,
      runnerId: added.runnerId?.value ?? null,
      createdAt: added.createdAt,
    });

    await this.writeMessages(added);
  }

  async save(saved: Chat): Promise<void> {
    await this.context.run(async () => {
      await this.stored(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async stored(saved: Chat): Promise<void> {
    const written = await this.context.db
      .update(chat)
      .set({
        version: saved.version + 1,
        currentRunId: saved.currentRunId?.value ?? null,
        sessionId: saved.sessionId?.value ?? null,
        runnerId: saved.runnerId?.value ?? null,
      })
      .where(and(eq(chat.id, saved.id.value), eq(chat.version, saved.version)))
      .returning({ id: chat.id });

    if (written.length === 0) {
      throw new ChatMovedOnError(saved.id.value);
    }

    await this.writeMessages(saved);
  }

  async find(id: ChatId): Promise<Chat | null> {
    const [found] = await this.context.db
      .select()
      .from(chat)
      .where(eq(chat.id, id.value))
      .limit(1);

    if (!found) {
      return null;
    }

    const [messages, attachments] = await Promise.all([
      this.context.db
        .select()
        .from(chatMessage)
        .where(eq(chatMessage.chatId, found.id))
        .orderBy(asc(chatMessage.position)),
      this.context.db
        .select()
        .from(chatAttachment)
        .where(eq(chatAttachment.chatId, found.id)),
    ]);

    return toChat(found, messages, attachments);
  }

  private async writeMessages(written: Chat): Promise<void> {
    await claimAttachments(
      this.context.db,
      written.workspaceId,
      { chatId: written.id.value },
      written.allAttachments,
    );

    for (const message of written.messages) {
      const position = message.position.value;
      const proposal = fromProposal(message.proposal);

      await this.context.db
        .insert(chatMessage)
        .values({
          chatId: written.id.value,
          position,
          kind: message.kind,
          body: message.body.value,
          at: message.at,
          authorId: message.author?.value ?? null,
          runId: message.runId?.value ?? null,
          traces: message.traces.map((each) => ({
            taskId: each.taskId.value,
            title: each.title.value,
            teamId: each.teamId.value,
          })),
          proposal,
          deliveredAt: message.deliveredAt,
          deliveredTo: message.deliveredTo?.value ?? null,
        })
        .onConflictDoUpdate({
          target: [chatMessage.chatId, chatMessage.position],
          set: {
            proposal,
            deliveredAt: message.deliveredAt,
            deliveredTo: message.deliveredTo?.value ?? null,
          },
        });

      if (message.attachments.length === 0) {
        continue;
      }

      await this.context.db
        .insert(chatAttachment)
        .values(
          message.attachments.map((each, place) => ({
            id: each.id.value,
            chatId: written.id.value,
            messagePosition: position,
            place,
            name: each.name,
            contentType: each.contentType,
            size: each.size,
          })),
        )
        .onConflictDoNothing({ target: chatAttachment.id });
    }
  }
}
