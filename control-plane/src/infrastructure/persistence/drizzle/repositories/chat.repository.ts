import { Chat } from '@domain/aggregates/chat.aggregate';
import { ChatMessage } from '@domain/entities/chat-message.entity';
import { TaskProposal } from '@domain/entities/task-proposal.entity';
import { ChatMovedOnError } from '@domain/exceptions/chat-moved-on.error';
import type { ChatRepository } from '@domain/repositories/chat.repository';
import { Attachment } from '@domain/value-objects/attachment.vo';
import { ChatId } from '@domain/value-objects/chat-id.vo';
import { ChatMessageBody } from '@domain/value-objects/chat-message-body.vo';
import { ChatTitle } from '@domain/value-objects/chat-title.vo';
import { Effort } from '@domain/value-objects/effort.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessModel } from '@domain/value-objects/harness-model.vo';
import { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { LineId } from '@domain/value-objects/line-id.vo';
import { MessagePosition } from '@domain/value-objects/message-position.vo';
import { ProposalPlacement } from '@domain/value-objects/proposal-placement.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { TaskDescription } from '@domain/value-objects/task-description.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import {
  chat,
  chatAttachment,
  chatMessage,
  type ProposalRow,
} from '@infrastructure/persistence/drizzle/schemas/chat.schema';
import { Injectable } from '@nestjs/common';
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
        placement: ProposalPlacement.rehydrate({
          lineId: LineId.of(row.lineId),
          stationId: StationId.of(row.stationId),
        }),
        title: TaskTitle.clamp(row.title),
        description: row.description
          ? TaskDescription.clamp(row.description)
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
    proposal: toProposal(row.proposal ?? null, position),
    deliveredAt: row.deliveredAt,
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
    messages: messages.map((each) => toMessage(each, attachments)),
    currentRunId: row.currentRunId ? RunId.of(row.currentRunId) : null,
    sessionId: row.sessionId ? HarnessSession.of(row.sessionId) : null,
    runnerId: row.runnerId ? RunnerId.of(row.runnerId) : null,
    createdAt: row.createdAt,
    version: row.version,
  });

@Injectable()
export class DrizzleChatRepository implements ChatRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(added: Chat): Promise<void> {
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
      currentRunId: added.currentRunId?.value ?? null,
      sessionId: added.sessionId?.value ?? null,
      runnerId: added.runnerId?.value ?? null,
      createdAt: added.createdAt,
    });

    await this.writeMessages(added);
  }

  async save(saved: Chat): Promise<void> {
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
          proposal,
          deliveredAt: message.deliveredAt,
        })
        .onConflictDoUpdate({
          target: [chatMessage.chatId, chatMessage.position],
          set: { proposal, deliveredAt: message.deliveredAt },
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
        .onConflictDoNothing();
    }
  }
}
