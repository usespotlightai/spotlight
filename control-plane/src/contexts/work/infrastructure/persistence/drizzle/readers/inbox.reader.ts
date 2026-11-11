import {
  PERSON_READER,
  type PersonReaderPort,
} from '@identity/application/ports/person-reader.port';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  type Cursor,
  encodeCursor,
  notNewerThan,
  sortableTime,
} from '@platform/persistence/drizzle/keyset';
import {
  RUN_PROGRESS,
  type RunProgressPort,
} from '@runs/application/ports/run-progress.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { Page, PageRequest } from '@work/application/dto/page.dto';
import { RunReadingMapper } from '@work/application/mappers/run-reading.mapper';
import type { AttachmentSummary } from '@work/application/ports/attachment-reader.port';
import type {
  InboxChatSummary,
  InboxEntrySummary,
  InboxItemSummary,
  InboxItemView,
  InboxNote,
  InboxNoticeSummary,
  InboxReaderPort,
  InboxRunSummary,
  InboxScope,
} from '@work/application/ports/inbox-reader.port';
import { inboxSectionOf } from '@work/application/read-models/inbox-section';
import {
  InboxRequest,
  type InboxRequestAudience,
} from '@work/domain/aggregates/inbox-request.aggregate';
import {
  Notice,
  type NoticeAudience,
} from '@work/domain/aggregates/notice.aggregate';
import { ConversationAudience } from '@work/domain/services/conversation-audience';
import {
  type Conversation,
  listedAsOpen,
  reopenable,
  stillOpen,
  worksOn,
} from '@work/domain/services/conversations';
import { anyUnread } from '@work/domain/services/unread';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { progressOfCurrentRun } from '@work/domain/value-objects/progress';
import {
  chatRunning,
  chatSectionOf,
  chatUnread,
  chatWaiting,
} from '@work/infrastructure/persistence/drizzle/readers/chat-inbox-state';
import { timeCursorOf } from '@work/infrastructure/persistence/drizzle/readers/page-cursor';
import {
  attachmentsFor,
  attachmentsOf,
  briefingsFor,
  type ConversationMark,
  conversationsAmong,
  failureIn,
  latestRunsAtCurrentStation,
  type MarkedConversation,
  marksFor,
  newestNotesFor,
  noteKey,
  notesAt,
  stationsPerLine,
  type TaskPlace,
  trailsFor,
} from '@work/infrastructure/persistence/drizzle/readers/task-trail';
import { chat } from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import {
  inboxRequest,
  inboxRequestRead,
} from '@work/infrastructure/persistence/drizzle/schemas/inbox-request.schema';
import { notice } from '@work/infrastructure/persistence/drizzle/schemas/notice.schema';
import {
  task,
  taskNote,
} from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { workStation } from '@work/infrastructure/persistence/drizzle/schemas/work-station.schema';
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const PAGES_TO_SKIP_OVER = 5;

const requestAudience = (audience: InboxRequestAudience): SQL | undefined =>
  or(
    eq(task.assigneeId, audience.assignee.value),
    audience.unassigned ? isNull(task.assigneeId) : undefined,
    audience.formsForTeamActors.length > 0
      ? inArray(inboxRequest.form, [...audience.formsForTeamActors])
      : undefined,
  );

const noticeAudience = (audience: NoticeAudience): SQL | undefined =>
  or(
    eq(notice.addresseeId, audience.addressee.value),
    audience.unaddressed ? isNull(notice.addresseeId) : undefined,
  );

interface Keyed {
  readonly entry: InboxEntrySummary;
  readonly cursor: Cursor;
}

interface Gathered {
  readonly keyed: readonly Keyed[];
  readonly floor: string | null;
}

const entryKey = (entry: InboxEntrySummary): string =>
  `${entry.kind}:${entry.id}`;

const keyedAt = (entry: InboxEntrySummary, at: string): Keyed => ({
  entry,
  cursor: { key: at, id: entryKey(entry) },
});

const newer = (one: Cursor, other: Cursor): boolean =>
  one.key > other.key || (one.key === other.key && one.id > other.id);

const floorOf = <T>(
  rows: readonly T[],
  fetched: number,
  at: (row: T) => string,
): string | null => {
  const last = rows[rows.length - 1];

  return rows.length === fetched && last ? at(last) : null;
};

const inTeamsSeen = (scope: InboxScope): SQL =>
  scope.teamsSeen.size > 0
    ? inArray(workStation.teamId, [...scope.teamsSeen])
    : sql`false`;

const taskRowsWhere = (
  db: DrizzleDatabase,
  scope: InboxScope,
  narrowedTo: SQL,
) => {
  const origin = alias(workStation, 'origin');

  return db
    .select({
      taskId: task.id,
      teamId: workStation.teamId,
      title: task.title,
      description: task.description,
      lineId: workStation.lineId,
      originStationName: origin.name,
      originColor: origin.color,
      originPosition: origin.position,
      currentStationId: task.stationId,
      currentStationName: workStation.name,
      currentStationColor: workStation.color,
      currentStationPosition: workStation.position,
      revision: task.revision,
      createdAt: task.createdAt,
      finishedAt: task.finishedAt,
      working: task.currentRunId,
    })
    .from(task)
    .innerJoin(workStation, eq(workStation.stationId, task.stationId))
    .leftJoin(origin, eq(origin.stationId, task.originStationId))
    .where(
      and(
        eq(task.workspaceId, scope.workspaceId),
        eq(
          task.assigneeId,
          ConversationAudience.assigneeShownTo(scope.viewer).value,
        ),
        inTeamsSeen(scope),
        narrowedTo,
      ),
    );
};

const tasksWhere = async (
  db: DrizzleDatabase,
  progress: RunProgressPort,
  scope: InboxScope,
  narrowedTo: SQL,
) => {
  const rows = await taskRowsWhere(db, scope, narrowedTo);
  const ids = [
    ...new Set(rows.flatMap((row) => (row.working ? [row.working] : []))),
  ];
  const facts = new Map(
    (ids.length === 0 ? [] : await progress.progressOf(ids.map(RunId.of))).map(
      (each) => [each.runId.value, each],
    ),
  );

  return rows.map((row) => {
    const working = row.working ? facts.get(row.working) : undefined;

    return {
      ...row,
      workingReading: RunReadingMapper.reading(working ?? null),
      workingSince: working?.queuedAt ?? null,
    };
  });
};

const requestsWhere = (
  db: DrizzleDatabase,
  workspaceId: string,
  userId: UserId,
  narrowedTo: SQL | undefined,
  limit: number | null,
) => {
  const query = db
    .select({
      id: inboxRequest.id,
      form: inboxRequest.form,
      about: inboxRequest.about,
      requestOpenedAt: inboxRequest.openedAt,
      cursorAt: sortableTime(inboxRequest.openedAt),
      readAt: inboxRequestRead.readAt,
      resolvedAt: inboxRequest.resolvedAt,
      taskId: task.id,
      assigneeId: task.assigneeId,
      teamId: workStation.teamId,
      lineId: workStation.lineId,
      title: task.title,
      description: task.description,
      createdAt: task.createdAt,
      currentStationId: task.stationId,
      currentStationName: workStation.name,
      currentStationColor: workStation.color,
      currentStationPosition: workStation.position,
      revision: task.revision,
    })
    .from(inboxRequest)
    .leftJoin(
      inboxRequestRead,
      and(
        eq(inboxRequestRead.inboxRequestId, inboxRequest.id),
        eq(inboxRequestRead.userId, userId.value),
      ),
    )
    .innerJoin(task, eq(task.id, inboxRequest.taskId))
    .innerJoin(workStation, eq(workStation.stationId, task.stationId))
    .where(
      and(
        eq(inboxRequest.workspaceId, workspaceId),
        requestAudience(InboxRequest.audienceOf(userId)),
        narrowedTo,
      ),
    )
    .orderBy(desc(inboxRequest.openedAt), desc(inboxRequest.id))
    .$dynamic();

  return limit === null ? query : query.limit(limit);
};

const noticesWhere = (
  db: DrizzleDatabase,
  workspaceId: string,
  userId: UserId,
  narrowedTo: SQL | undefined,
  limit: number | null,
) => {
  const query = db
    .select({ notice, cursorAt: sortableTime(notice.createdAt) })
    .from(notice)
    .where(
      and(
        eq(notice.workspaceId, workspaceId),
        noticeAudience(Notice.audienceOf(userId)),
        narrowedTo,
      ),
    )
    .orderBy(desc(notice.createdAt), desc(notice.id))
    .$dynamic();

  return limit === null ? query : query.limit(limit);
};

const chatsWhere = (
  db: DrizzleDatabase,
  scope: InboxScope,
  narrowedTo: SQL | undefined,
  limit: number | null,
) => {
  const query = db
    .select({
      id: chat.id,
      teamId: chat.teamId,
      title: chat.title,
      working: chat.currentRunId,
      resolvedAt: chat.resolvedAt,
      cursorAt: sortableTime(chat.resolvedAt),
      lastAt:
        sql<Date>`(select max("chat_message"."at") from "chat_message" where "chat_message"."chat_id" = "chat"."id")`.mapWith(
          (value: string) => new Date(value),
        ),
      openProposals:
        sql<number>`(select count(*) from "chat_message" where "chat_message"."chat_id" = "chat"."id" and "chat_message"."kind" = 'proposed' and "chat_message"."proposal"->>'state' = 'open')`.mapWith(
          Number,
        ),
      unread: chatUnread,
      waiting: chatWaiting,
    })
    .from(chat)
    .where(
      and(
        eq(chat.workspaceId, scope.workspaceId),
        eq(chat.startedById, scope.viewer.value),
        scope.teamsSeen.size > 0
          ? inArray(chat.teamId, [...scope.teamsSeen])
          : sql`false`,
        narrowedTo,
      ),
    )
    .orderBy(desc(chat.resolvedAt), desc(chat.id))
    .$dynamic();

  return limit === null ? query : query.limit(limit);
};

type ChatRow = Awaited<ReturnType<typeof chatsWhere>>[number];

type TaskRow = Awaited<ReturnType<typeof tasksWhere>>[number];

const placeOf = (row: {
  readonly taskId: string;
  readonly currentStationId: string;
  readonly revision: number;
}): TaskPlace => ({
  taskId: row.taskId,
  stationId: row.currentStationId,
  revision: row.revision,
});

interface TaskContext {
  readonly stationCounts: ReadonlyMap<string, number>;
  readonly attached: ReadonlyMap<string, { own: readonly AttachmentSummary[] }>;
  readonly briefings: ReadonlyMap<string, string>;
  readonly latestRuns: ReadonlyMap<string, string>;
}

const positionsOf = (
  conversation: MarkedConversation<{ readonly position: number }>,
): Conversation => ({
  from: NotePosition.of(conversation.from.position),
  to:
    conversation.to === null ? null : NotePosition.of(conversation.to.position),
});

const latestOf = (
  conversations: readonly MarkedConversation<{ readonly position: number }>[],
): Conversation | null => {
  const latest = conversations[conversations.length - 1];

  return latest ? positionsOf(latest) : null;
};

const closingOf = (
  conversation: MarkedConversation<{ readonly position: number }>,
  lastNote: InboxNote | null,
) =>
  lastNote && lastNote.position === conversation.to?.position
    ? { form: lastNote.form, byAPerson: lastNote.voice === 'person' }
    : null;

const conversationItem = (
  row: TaskRow,
  conversation: MarkedConversation<ConversationMark>,
  latest: Conversation | null,
  lastNote: InboxNote | null,
  context: TaskContext,
): InboxItemSummary => {
  const opening = conversation.from;
  const open = stillOpen(conversation);
  const last = conversation.notes[conversation.notes.length - 1];
  const progress =
    open && worksOn(row.working !== null, conversation.notes)
      ? progressOfCurrentRun(row.workingReading, true)
      : null;
  const unread = anyUnread(conversation.notes);

  return {
    kind: 'task',
    id: ConversationId.of({
      taskId: TaskId.of(row.taskId),
      from: opening.position,
    }).value,
    taskId: row.taskId,
    teamId: row.teamId,
    title: row.title,
    description: row.description,
    attachments: context.attached.get(row.taskId)?.own ?? [],
    station: opening.station,
    stationColor: opening.stationColor,
    stationPosition: opening.stationPosition,
    stationCount: context.stationCounts.get(row.lineId) ?? 1,
    originStation: {
      name: row.originStationName ?? opening.station,
      color: row.originColor ?? opening.stationColor,
      position: row.originPosition ?? opening.stationPosition,
    },
    currentStation: {
      name: row.currentStationName,
      color: row.currentStationColor,
      position: row.currentStationPosition,
      latestRunId: row.working ?? context.latestRuns.get(row.taskId) ?? null,
    },
    createdAt: row.createdAt,
    askedAt: lastNote?.at ?? last?.at ?? opening.at,
    resolved: !open,
    section: inboxSectionOf({
      unread,
      resolved: !open,
      running: progress !== null,
    }),
    reopenable: reopenable(
      NotePosition.of(opening.position),
      latest,
      closingOf(conversation, lastNote),
    ),
    progress,
    runId: open ? row.working : null,
    unread,
    briefing: (opening.runId && context.briefings.get(opening.runId)) || null,
    failure: failureIn(conversation.notes),
    inboxRequest: null,
    lastNote,
  };
};

const runItem = (
  row: TaskRow,
  working: string,
  context: TaskContext,
): InboxRunSummary | null => {
  const progress = progressOfCurrentRun(row.workingReading, true);

  return progress
    ? {
        kind: 'run',
        id: working,
        taskId: row.taskId,
        teamId: row.teamId,
        title: row.title,
        station: row.currentStationName,
        stationColor: row.currentStationColor,
        stationPosition: row.currentStationPosition,
        stationCount: context.stationCounts.get(row.lineId) ?? 1,
        progress,
        askedAt: row.workingSince ?? row.createdAt,
        unread: false,
        resolved: false,
        section: inboxSectionOf({
          unread: false,
          resolved: false,
          running: true,
        }),
        reopenable: false,
      }
    : null;
};

type RequestRow = Awaited<ReturnType<typeof requestsWhere>>[number];

type NoticeRow = Awaited<ReturnType<typeof noticesWhere>>[number];

@Injectable()
export class DrizzleInboxReader implements InboxReaderPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(PERSON_READER) private readonly people: PersonReaderPort,
    @Inject(RUN_PROGRESS) private readonly progress: RunProgressPort,
  ) {}

  async open(scope: InboxScope): Promise<InboxEntrySummary[]> {
    const { workspaceId, viewer: userId } = scope;

    const [tasks, requests, notices, chats] = await Promise.all([
      this.openTasks(scope),
      requestsWhere(
        this.db,
        workspaceId,
        userId,
        isNull(inboxRequest.resolvedAt),
        null,
      ),
      noticesWhere(
        this.db,
        workspaceId,
        userId,
        isNull(notice.resolvedAt),
        null,
      ),
      chatsWhere(
        this.db,
        scope,
        sql`(${isNull(chat.resolvedAt)} or ${chatRunning})`,
        null,
      ),
    ]);
    const items: InboxEntrySummary[] = [
      ...tasks,
      ...(await this.requestItems(scope, requests)).map((each) => each.entry),
      ...(await this.noticeItems(scope, notices)).map((each) => each.entry),
      ...(await this.chatItems(chats)).map((each) => each.entry),
    ];

    return items.sort((one, other) => +other.askedAt - +one.askedAt);
  }

  async resolved(
    scope: InboxScope,
    page: PageRequest,
  ): Promise<Page<InboxEntrySummary>> {
    let before = timeCursorOf(page.before);

    for (let skipped = 0; skipped < PAGES_TO_SKIP_OVER; skipped++) {
      const found = await this.resolvedPage(scope, before, page.limit);

      if (found.items.length > 0 || found.next === null) {
        return {
          items: found.items.map((each) => each.entry),
          next: found.next && encodeCursor(found.next),
        };
      }

      before = found.next;
    }

    return { items: [], next: before && encodeCursor(before) };
  }

  async item(scope: InboxScope, itemId: string): Promise<InboxItemView | null> {
    const conversationId = ConversationId.tryParse(itemId);

    return conversationId
      ? this.conversationView(scope, conversationId)
      : this.requestView(scope, itemId);
  }

  async notice(
    scope: InboxScope,
    noticeId: string,
  ): Promise<InboxNoticeSummary | null> {
    const rows = await noticesWhere(
      this.db,
      scope.workspaceId,
      scope.viewer,
      eq(notice.id, noticeId),
      null,
    );
    const [found] = await this.noticeItems(scope, rows);

    return found && found.entry.kind === 'notice' ? found.entry : null;
  }

  private async resolvedPage(
    scope: InboxScope,
    before: Cursor | null,
    limit: number,
  ): Promise<{ items: readonly Keyed[]; next: Cursor | null }> {
    const fetched = limit + 1;
    const sources = await Promise.all([
      this.resolvedConversations(scope, before, fetched),
      this.resolvedRequests(scope, before, fetched),
      this.resolvedNotices(scope, before, fetched),
      this.resolvedChats(scope, before, fetched),
    ]);
    const floors = sources.flatMap((each) => (each.floor ? [each.floor] : []));
    const floor = floors.sort()[floors.length - 1] ?? null;
    const shown = sources
      .flatMap((each) => each.keyed)
      .filter(
        (each) =>
          (!before || newer(before, each.cursor)) &&
          (floor === null || each.cursor.key >= floor),
      )
      .sort((one, other) => (newer(one.cursor, other.cursor) ? -1 : 1));
    const items = shown.slice(0, limit);
    const last = items[items.length - 1];
    const more = shown.length > limit || floor !== null;

    if (!more) {
      return { items, next: null };
    }

    return {
      items,
      next: last ? last.cursor : floor ? { key: floor, id: '' } : null,
    };
  }

  private async resolvedConversations(
    scope: InboxScope,
    before: Cursor | null,
    fetched: number,
  ): Promise<Gathered> {
    const { workspaceId, viewer: userId } = scope;
    const closing = await this.db
      .select({
        taskId: taskNote.taskId,
        position: taskNote.position,
        cursorAt: sortableTime(taskNote.at),
      })
      .from(taskNote)
      .innerJoin(task, eq(task.id, taskNote.taskId))
      .where(
        and(
          eq(task.workspaceId, workspaceId),
          eq(
            task.assigneeId,
            ConversationAudience.assigneeShownTo(userId).value,
          ),
          eq(taskNote.closesConversation, true),
          before ? notNewerThan(taskNote.at, before) : undefined,
        ),
      )
      .orderBy(
        desc(taskNote.at),
        desc(taskNote.taskId),
        desc(taskNote.position),
      )
      .limit(fetched);

    const closedAt = new Map(
      closing.map((each) => [noteKey(each), each.cursorAt] as const),
    );
    const taskIds = [...new Set(closing.map((each) => each.taskId))];
    const rows = await tasksWhere(
      this.db,
      this.progress,
      scope,
      inArray(task.id, taskIds),
    );
    const marks = await marksFor(this.db, taskIds);
    const resolved = rows.flatMap((row) => {
      const conversations = conversationsAmong(marks.get(row.taskId) ?? []);
      const latest = latestOf(conversations);

      return conversations.flatMap((conversation) => {
        const at =
          conversation.to &&
          closedAt.get(
            noteKey({
              taskId: row.taskId,
              position: conversation.to.position,
            }),
          );

        return at ? [{ row, conversation, latest, at }] : [];
      });
    });
    const [context, lastNotes] = await Promise.all([
      this.contextFor(
        rows,
        resolved.map((each) => each.conversation),
      ),
      notesAt(
        this.db,
        this.people,
        resolved.flatMap(({ row, conversation }) =>
          conversation.to
            ? [{ taskId: row.taskId, position: conversation.to.position }]
            : [],
        ),
      ),
    ]);

    return {
      keyed: resolved.map(({ row, conversation, latest, at }) =>
        keyedAt(
          conversationItem(
            row,
            conversation,
            latest,
            (conversation.to &&
              lastNotes.get(
                noteKey({
                  taskId: row.taskId,
                  position: conversation.to.position,
                }),
              )) ??
              null,
            context,
          ),
          at,
        ),
      ),
      floor: floorOf(closing, fetched, (each) => each.cursorAt),
    };
  }

  private async resolvedRequests(
    scope: InboxScope,
    before: Cursor | null,
    fetched: number,
  ): Promise<Gathered> {
    const rows = await requestsWhere(
      this.db,
      scope.workspaceId,
      scope.viewer,
      and(
        isNotNull(inboxRequest.resolvedAt),
        before ? notNewerThan(inboxRequest.openedAt, before) : undefined,
      ),
      fetched,
    );

    return {
      keyed: await this.requestItems(scope, rows),
      floor: floorOf(rows, fetched, (each) => each.cursorAt),
    };
  }

  private async resolvedNotices(
    scope: InboxScope,
    before: Cursor | null,
    fetched: number,
  ): Promise<Gathered> {
    const rows = await noticesWhere(
      this.db,
      scope.workspaceId,
      scope.viewer,
      and(
        isNotNull(notice.resolvedAt),
        before ? notNewerThan(notice.createdAt, before) : undefined,
      ),
      fetched,
    );

    return {
      keyed: await this.noticeItems(scope, rows),
      floor: floorOf(rows, fetched, (each) => each.cursorAt),
    };
  }

  private async resolvedChats(
    scope: InboxScope,
    before: Cursor | null,
    fetched: number,
  ): Promise<Gathered> {
    const rows = await chatsWhere(
      this.db,
      scope,
      and(
        isNotNull(chat.resolvedAt),
        sql`not ${chatRunning}`,
        before ? notNewerThan(chat.resolvedAt, before) : undefined,
      ),
      fetched,
    );

    return {
      keyed: await this.chatItems(rows),
      floor: floorOf(rows, fetched, (each) => each.cursorAt),
    };
  }

  private async openTasks(
    scope: InboxScope,
  ): Promise<(InboxItemSummary | InboxRunSummary)[]> {
    const rows = await tasksWhere(
      this.db,
      this.progress,
      scope,
      sql`(${isNull(task.finishedAt)} or ${task.unreadAsk})`,
    );
    const taskIds = rows.map((row) => row.taskId);
    const [marks, newest] = await Promise.all([
      marksFor(this.db, taskIds),
      newestNotesFor(this.db, this.people, taskIds),
    ]);
    const all = new Map(
      rows.map(
        (row) =>
          [
            row.taskId,
            conversationsAmong(marks.get(row.taskId) ?? []),
          ] as const,
      ),
    );
    const shown = new Map(
      rows.map(
        (row) =>
          [
            row.taskId,
            (all.get(row.taskId) ?? []).filter((conversation) =>
              listedAsOpen(conversation, row.finishedAt !== null),
            ),
          ] as const,
      ),
    );
    const conversations = [...shown.values()].flat();
    const [context, closingNotes] = await Promise.all([
      this.contextFor(rows, conversations),
      notesAt(
        this.db,
        this.people,
        rows.flatMap((row) =>
          (shown.get(row.taskId) ?? []).flatMap((conversation) =>
            conversation.to
              ? [{ taskId: row.taskId, position: conversation.to.position }]
              : [],
          ),
        ),
      ),
    ]);

    return rows.flatMap((row) => {
      const listed = shown.get(row.taskId) ?? [];
      const latest = latestOf(all.get(row.taskId) ?? []);
      const working =
        row.working && !listed.some(stillOpen)
          ? runItem(row, row.working, context)
          : null;

      return [
        ...(working ? [working] : []),
        ...listed.map((conversation) =>
          conversationItem(
            row,
            conversation,
            latest,
            conversation.to
              ? (closingNotes.get(
                  noteKey({
                    taskId: row.taskId,
                    position: conversation.to.position,
                  }),
                ) ?? null)
              : (newest.get(row.taskId) ?? null),
            context,
          ),
        ),
      ];
    });
  }

  private async conversationView(
    scope: InboxScope,
    conversationId: ConversationId,
  ): Promise<InboxItemView | null> {
    const [row] = await tasksWhere(
      this.db,
      this.progress,
      scope,
      eq(task.id, conversationId.taskId.value),
    );

    if (!row) {
      return null;
    }

    const trail =
      (await trailsFor(this.db, this.people, [row.taskId])).get(row.taskId) ??
      [];
    const conversations = conversationsAmong(trail);
    const conversation = conversations.find(
      (each) => each.from.position === conversationId.from.value,
    );

    if (!conversation) {
      return null;
    }

    const context = await this.contextFor([row], [conversation]);
    const notes = conversation.notes;

    return {
      ...conversationItem(
        row,
        conversation,
        latestOf(conversations),
        notes[notes.length - 1] ?? null,
        context,
      ),
      notes,
    };
  }

  private async requestView(
    scope: InboxScope,
    requestId: string,
  ): Promise<InboxItemView | null> {
    const rows = await requestsWhere(
      this.db,
      scope.workspaceId,
      scope.viewer,
      eq(inboxRequest.id, requestId),
      null,
    );
    const [found] = await this.requestItems(scope, rows);

    return found && found.entry.kind === 'task'
      ? { ...found.entry, notes: [] }
      : null;
  }

  private async contextFor(
    rows: readonly TaskRow[],
    conversations: readonly MarkedConversation<ConversationMark>[],
  ): Promise<TaskContext> {
    const [stationCounts, attached, briefings, latestRuns] = await Promise.all([
      stationsPerLine(
        this.db,
        rows.map((row) => row.lineId),
      ),
      attachmentsFor(
        this.db,
        rows.map((row) => row.taskId),
      ),
      briefingsFor(
        this.db,
        conversations.flatMap((each) =>
          each.from.runId ? [each.from.runId] : [],
        ),
      ),
      latestRunsAtCurrentStation(this.db, rows.map(placeOf)),
    ]);

    return { stationCounts, attached, briefings, latestRuns };
  }

  private async requestItems(
    scope: InboxScope,
    rows: readonly RequestRow[],
  ): Promise<Keyed[]> {
    const attending = rows.filter((row) =>
      InboxRequest.visibleTo({
        form: row.form,
        viewer: scope.viewer,
        assignee: row.assigneeId ? UserId.of(row.assigneeId) : null,
        seesTeam: scope.teamsSeen.has(row.teamId),
        actsOnTeam: scope.teamsActedOn.has(row.teamId),
      }),
    );

    if (attending.length === 0) {
      return [];
    }

    const [attached, stationCounts, latestRuns] = await Promise.all([
      attachmentsFor(
        this.db,
        attending.map((row) => row.taskId),
      ),
      stationsPerLine(
        this.db,
        attending.map((row) => row.lineId),
      ),
      latestRunsAtCurrentStation(this.db, attending.map(placeOf)),
    ]);

    return attending.map((row) => {
      const currentStation = {
        name: row.currentStationName,
        color: row.currentStationColor,
        position: row.currentStationPosition,
      };

      return keyedAt(
        {
          kind: 'task',
          id: row.id,
          taskId: row.taskId,
          teamId: row.teamId,
          title: row.title,
          description: row.description,
          attachments: attachmentsOf(attached, row.taskId).own,
          station: currentStation.name,
          stationColor: currentStation.color,
          stationPosition: currentStation.position,
          stationCount: stationCounts.get(row.lineId) ?? 1,
          originStation: currentStation,
          currentStation: {
            ...currentStation,
            latestRunId: latestRuns.get(row.taskId) ?? null,
          },
          createdAt: row.createdAt,
          askedAt: row.requestOpenedAt,
          resolved: row.resolvedAt !== null,
          section: inboxSectionOf({
            unread: InboxRequest.unread(row),
            resolved: row.resolvedAt !== null,
            running: false,
          }),
          reopenable: InboxRequest.reopenable(row.resolvedAt),
          progress: null,
          runId: null,
          unread: InboxRequest.unread(row),
          briefing: null,
          failure: null,
          inboxRequest: { form: row.form, about: row.about },
          lastNote: null,
        },
        row.cursorAt,
      );
    });
  }

  private async noticeItems(
    scope: InboxScope,
    rows: readonly NoticeRow[],
  ): Promise<Keyed[]> {
    return rows
      .filter(
        (row) =>
          scope.teamsSeen.has(row.notice.teamId) &&
          Notice.addressedTo(
            row.notice.addresseeId ? UserId.of(row.notice.addresseeId) : null,
            scope.viewer,
          ),
      )
      .map(({ notice: row, cursorAt }) =>
        keyedAt(
          {
            kind: 'notice',
            id: row.id,
            teamId: row.teamId,
            form: row.form,
            headline: row.headline,
            points: row.points,
            link: row.link,
            linkLabel: row.linkLabel,
            externalLink:
              row.externalUrl !== null && row.externalLabel !== null
                ? { url: row.externalUrl, label: row.externalLabel }
                : null,
            askedAt: row.createdAt,
            unread: Notice.unread(row.resolvedAt),
            resolved: row.resolvedAt !== null,
            section: inboxSectionOf({
              unread: Notice.unread(row.resolvedAt),
              resolved: row.resolvedAt !== null,
              running: false,
            }),
            reopenable: Notice.reopenable(row.resolvedAt),
          },
          cursorAt,
        ),
      );
  }

  private async chatItems(rows: readonly ChatRow[]): Promise<Keyed[]> {
    const ids = [
      ...new Set(rows.flatMap((row) => (row.working ? [row.working] : []))),
    ];
    const facts = new Map(
      (ids.length === 0
        ? []
        : await this.progress.progressOf(ids.map(RunId.of))
      ).map((each) => [each.runId.value, each]),
    );

    return rows.map((row) => {
      const running = row.working !== null || row.waiting;
      const resolved = row.resolvedAt !== null && !running;
      const working = row.working ? facts.get(row.working) : undefined;
      const entry: InboxChatSummary = {
        kind: 'chat',
        id: row.id,
        teamId: row.teamId,
        title: row.title,
        progress: running
          ? progressOfCurrentRun(
              RunReadingMapper.reading(working ?? null),
              true,
            )
          : null,
        openProposals: row.openProposals,
        askedAt: row.lastAt,
        unread: row.unread,
        resolved,
        section: chatSectionOf(row),
        reopenable: resolved,
      };

      return keyedAt(entry, row.cursorAt ?? '');
    });
  }
}
