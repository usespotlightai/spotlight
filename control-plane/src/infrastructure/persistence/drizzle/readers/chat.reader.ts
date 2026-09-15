import type {
  ChatReaderPort,
  ChatSummary,
  ChatView,
} from '@application/ports/chat-reader.port';
import type { ChatId } from '@domain/value-objects/chat-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import { user } from '@infrastructure/persistence/drizzle/schemas/auth.schema';
import {
  chat,
  chatAttachment,
  chatMessage,
} from '@infrastructure/persistence/drizzle/schemas/chat.schema';
import {
  line,
  station,
} from '@infrastructure/persistence/drizzle/schemas/line.schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';

type Row = typeof chat.$inferSelect;

const summaryOf = (row: Row): ChatSummary => ({
  id: row.id,
  title: row.title,
  harness: row.harness,
  model: row.model,
  effort: row.effort,
  repositories: row.repositories,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  working: row.currentRunId !== null,
});

@Injectable()
export class DrizzleChatReader implements ChatReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async startedBy(teamId: TeamId, userId: UserId): Promise<ChatSummary[]> {
    const rows = await this.db
      .select()
      .from(chat)
      .where(
        and(eq(chat.teamId, teamId.value), eq(chat.startedById, userId.value)),
      )
      .orderBy(desc(chat.updatedAt));

    return rows.map(summaryOf);
  }

  async read(
    teamId: TeamId,
    chatId: ChatId,
    viewerId: UserId,
  ): Promise<ChatView | null> {
    const [row] = await this.db
      .select()
      .from(chat)
      .where(
        and(
          eq(chat.id, chatId.value),
          eq(chat.teamId, teamId.value),
          eq(chat.startedById, viewerId.value),
        ),
      )
      .limit(1);

    if (!row) {
      return null;
    }

    const [messages, attachments, [starter]] = await Promise.all([
      this.db
        .select()
        .from(chatMessage)
        .where(eq(chatMessage.chatId, row.id))
        .orderBy(asc(chatMessage.position)),
      this.db
        .select()
        .from(chatAttachment)
        .where(eq(chatAttachment.chatId, row.id))
        .orderBy(asc(chatAttachment.place)),
      this.db
        .select({ id: user.id, name: user.name, image: user.image })
        .from(user)
        .where(eq(user.id, row.startedById))
        .limit(1),
    ]);

    const proposedAt = messages.flatMap((each) =>
      each.proposal ? [each.proposal.stationId] : [],
    );
    const stations =
      proposedAt.length > 0
        ? await this.db
            .select({
              id: station.id,
              name: station.name,
              color: station.color,
              lineName: line.name,
            })
            .from(station)
            .innerJoin(line, eq(line.id, station.lineId))
            .where(inArray(station.id, proposedAt))
        : [];

    return {
      ...summaryOf(row),
      runId: row.currentRunId,
      messages: messages.map((message) => {
        const proposal = message.proposal ?? null;
        const placed = proposal
          ? stations.find((each) => each.id === proposal.stationId)
          : undefined;

        return {
          position: message.position,
          kind: message.kind,
          body: message.body,
          at: message.at.toISOString(),
          author:
            message.authorId && starter?.id === message.authorId
              ? starter
              : null,
          runId: message.runId,
          attachments: attachments
            .filter((each) => each.messagePosition === message.position)
            .map((each) => ({
              id: each.id,
              name: each.name,
              contentType: each.contentType,
              size: each.size,
            })),
          proposal: proposal && {
            lineId: proposal.lineId,
            lineName: placed?.lineName ?? null,
            stationId: proposal.stationId,
            stationName: placed?.name ?? null,
            stationColor: placed?.color ?? null,
            title: proposal.title,
            description: proposal.description,
            state: proposal.state,
            taskId: proposal.taskId,
          },
        };
      }),
    };
  }
}
