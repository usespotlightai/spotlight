import {
  PERSON_READER,
  type PersonReaderPort,
} from '@identity/application/ports/person-reader.port';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type {
  ChatReaderPort,
  ChatSummary,
  ChatView,
} from '@work/application/ports/chat-reader.port';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import {
  chat,
  chatAttachment,
  chatMessage,
} from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import {
  line,
  station,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
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
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(PERSON_READER) private readonly people: PersonReaderPort,
  ) {}

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
      this.people.find(UserId.of(row.startedById)).then((found) => [found]),
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
          traces: message.traces.map(({ taskId, title }) => ({
            taskId,
            title,
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
