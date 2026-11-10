import {
  PERSON_READER,
  type PersonReaderPort,
} from '@identity/application/ports/person-reader.port';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  olderThan,
  pageOf,
  sortableTime,
} from '@platform/persistence/drizzle/keyset';
import {
  RUN_PROGRESS,
  type RunProgressPort,
} from '@runs/application/ports/run-progress.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import {
  mapPage,
  type Page,
  type PageRequest,
} from '@work/application/dto/page.dto';
import type {
  ChatOwnership,
  ChatReaderPort,
  ChatSummary,
  ChatView,
  SetupChatView,
} from '@work/application/ports/chat-reader.port';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { Progress } from '@work/domain/value-objects/progress';
import {
  chatSectionOf,
  chatUnread,
  chatWaiting,
} from '@work/infrastructure/persistence/drizzle/readers/chat-inbox-state';
import { progressOfCurrentRuns } from '@work/infrastructure/persistence/drizzle/readers/current-progress';
import { timeCursorOf } from '@work/infrastructure/persistence/drizzle/readers/page-cursor';
import { stationsPerLine } from '@work/infrastructure/persistence/drizzle/readers/task-trail';
import {
  chat,
  chatAttachment,
  chatMessage,
} from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { workStation } from '@work/infrastructure/persistence/drizzle/schemas/work-station.schema';
import { and, asc, desc, eq, inArray, isNotNull } from 'drizzle-orm';

type Row = typeof chat.$inferSelect;

const inboxFacts = { unread: chatUnread, waiting: chatWaiting };

type InboxFacts = Record<keyof typeof inboxFacts, boolean>;

const summaryOf = (
  row: Row,
  facts: InboxFacts,
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
  progress:
    row.currentRunId === null
      ? facts.waiting
        ? 'queued'
        : null
      : progressOf(row.currentRunId),
  waitingForYou:
    chatSectionOf({
      ...facts,
      resolvedAt: row.resolvedAt,
      working: row.currentRunId,
    }) === 'open',
});

@Injectable()
export class DrizzleChatReader implements ChatReaderPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(PERSON_READER) private readonly people: PersonReaderPort,
    @Inject(RUN_PROGRESS) private readonly progress: RunProgressPort,
  ) {}

  async ownershipOf(chatId: ChatId): Promise<ChatOwnership | null> {
    const [row] = await this.db
      .select({ startedById: chat.startedById, teamId: chat.teamId })
      .from(chat)
      .where(eq(chat.id, chatId.value))
      .limit(1);

    return row
      ? { startedBy: UserId.of(row.startedById), teamId: TeamId.of(row.teamId) }
      : null;
  }

  async setupChatsOf(teamId: TeamId): Promise<readonly SetupChatView[]> {
    const rows = await this.db
      .select({
        id: chat.id,
        setup: chat.setup,
        startedById: chat.startedById,
        createdAt: chat.createdAt,
      })
      .from(chat)
      .where(and(eq(chat.teamId, teamId.value), isNotNull(chat.setup)))
      .orderBy(desc(chat.createdAt));
    const starters = new Map(
      await Promise.all(
        [...new Set(rows.map((each) => each.startedById))].map(
          async (id) =>
            [id, (await this.people.find(UserId.of(id)))?.name ?? ''] as const,
        ),
      ),
    );

    return rows.map((row) => {
      const ci = row.setup?.ci ?? null;

      return {
        id: row.id,
        repository: row.setup?.repository ?? '',
        pullRequest: row.setup?.pullRequest ?? null,
        ci: ci && {
          defaultBranch: ci.defaultBranch,
          defaultBranchProtected: ci.defaultBranchProtected,
          variables: ci.variables,
        },
        startedById: row.startedById,
        startedBy: starters.get(row.startedById) ?? '',
        startedAt: row.createdAt,
      };
    });
  }

  async startedBy(
    teamId: TeamId,
    userId: UserId,
    page: PageRequest,
  ): Promise<Page<ChatSummary>> {
    const before = timeCursorOf(page.before);
    const rows = await this.db
      .select({ chat, cursorAt: sortableTime(chat.updatedAt), ...inboxFacts })
      .from(chat)
      .where(
        and(
          eq(chat.teamId, teamId.value),
          eq(chat.startedById, userId.value),
          before ? olderThan(chat.updatedAt, chat.id, before) : undefined,
        ),
      )
      .orderBy(desc(chat.updatedAt), desc(chat.id))
      .limit(page.limit + 1);

    const progressOf = await progressOfCurrentRuns(
      this.progress,
      rows.map((row) => row.chat.currentRunId),
      false,
    );

    return mapPage(
      pageOf(rows, page.limit, (row) => ({
        key: row.cursorAt,
        id: row.chat.id,
      })),
      (row) => summaryOf(row.chat, row, progressOf),
    );
  }

  async read(teamId: TeamId, chatId: ChatId): Promise<ChatView | null> {
    const [found] = await this.db
      .select({ chat, ...inboxFacts })
      .from(chat)
      .where(and(eq(chat.id, chatId.value), eq(chat.teamId, teamId.value)))
      .limit(1);

    if (!found) {
      return null;
    }

    const row = found.chat;
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
      progressOfCurrentRuns(this.progress, [row.currentRunId], false),
    ]);

    const proposedAt = messages.flatMap((each) =>
      each.proposal ? [each.proposal.stationId] : [],
    );
    const stations =
      proposedAt.length > 0
        ? await this.db
            .select({
              id: workStation.stationId,
              name: workStation.name,
              color: workStation.color,
              position: workStation.position,
              lineId: workStation.lineId,
              lineName: workStation.lineName,
            })
            .from(workStation)
            .where(inArray(workStation.stationId, proposedAt))
        : [];
    const stationCounts = await stationsPerLine(
      this.db,
      stations.map((each) => each.lineId),
    );

    return {
      ...summaryOf(row, found, progressOf),
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
            starter && message.authorId === starter.id.value
              ? {
                  id: starter.id.value,
                  name: starter.name,
                  image: starter.image,
                }
              : null,
          runId: message.runId,
          takenUpBy: message.acknowledgedByRunId,
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
