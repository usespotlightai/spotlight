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
  SetupChatView,
} from '@work/application/ports/chat-reader.port';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { Progress } from '@work/domain/value-objects/run-state';
import { progressOfCurrentRuns } from '@work/infrastructure/persistence/drizzle/readers/current-progress';
import { stationsPerLine } from '@work/infrastructure/persistence/drizzle/readers/task-trail';
import {
  chat,
  chatAttachment,
  chatMessage,
} from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import {
  line,
  station,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { and, asc, desc, eq, inArray, isNotNull } from 'drizzle-orm';

type Row = typeof chat.$inferSelect;

const summaryOf = (
  row: Row,
  progressOf: (runId: string | null) => Progress | null,
): ChatSummary => ({
  id: row.id,
  title: row.title,
  harness: row.harness,
  model: row.model,
  effort: row.effort,
  repositories: row.repositories,
  targetStation: row.targetStation ?? null,
  setup: row.setup ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  progress: progressOf(row.currentRunId),
});

@Injectable()
export class DrizzleChatReader implements ChatReaderPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(PERSON_READER) private readonly people: PersonReaderPort,
  ) {}

  async setupOf(teamId: TeamId): Promise<SetupChatView | null> {
    const rows = await this.db
      .select({
        id: chat.id,
        setup: chat.setup,
        startedById: chat.startedById,
      })
      .from(chat)
      .where(and(eq(chat.teamId, teamId.value), isNotNull(chat.setup)))
      .orderBy(desc(chat.createdAt));
    const opened = rows.find((each) => each.setup?.pullRequest);
    const latest = opened ?? rows[0];

    if (!latest) {
      return null;
    }

    const starter = await this.people.find(UserId.of(latest.startedById));

    return {
      id: latest.id,
      pullRequest: latest.setup?.pullRequest ?? null,
      startedById: latest.startedById,
      startedBy: starter?.name ?? '',
    };
  }

  async startedBy(teamId: TeamId, userId: UserId): Promise<ChatSummary[]> {
    const rows = await this.db
      .select()
      .from(chat)
      .where(
        and(eq(chat.teamId, teamId.value), eq(chat.startedById, userId.value)),
      )
      .orderBy(desc(chat.updatedAt));

    const progressOf = await progressOfCurrentRuns(
      this.db,
      rows.map((row) => row.currentRunId),
      false,
    );

    return rows.map((row) => summaryOf(row, progressOf));
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

    const [messages, attachments, [starter], progressOf] = await Promise.all([
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
      progressOfCurrentRuns(this.db, [row.currentRunId], false),
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
              position: station.position,
              lineId: station.lineId,
              lineName: line.name,
            })
            .from(station)
            .innerJoin(line, eq(line.id, station.lineId))
            .where(inArray(station.id, proposedAt))
        : [];
    const stationCounts = await stationsPerLine(
      this.db,
      stations.map((each) => each.lineId),
    );

    return {
      ...summaryOf(row, progressOf),
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
            stationPosition: placed?.position ?? null,
            stationCount: placed
              ? (stationCounts.get(placed.lineId) ?? 1)
              : null,
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
