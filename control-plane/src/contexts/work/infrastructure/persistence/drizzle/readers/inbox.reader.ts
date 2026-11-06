import {
  PERSON_READER,
  type PersonReaderPort,
} from '@identity/application/ports/person-reader.port';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import {
  WORKSPACE_READER,
  type WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  type Cursor,
  encodeCursor,
  notNewerThan,
  sortableTime,
} from '@platform/persistence/drizzle/keyset';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Page, PageRequest } from '@work/application/dto/page.dto';
import type { AttachmentSummary } from '@work/application/ports/attachment-reader.port';
import type {
  InboxEntrySummary,
  InboxItemSummary,
  InboxItemView,
  InboxNote,
  InboxNoticeSummary,
  InboxReaderPort,
  InboxRunSummary,
} from '@work/application/ports/inbox-reader.port';
import {
  InboxRequest,
  type InboxRequestAccess,
} from '@work/domain/aggregates/inbox-request.aggregate';
import { Notice } from '@work/domain/aggregates/notice.aggregate';
import {
  type Conversation,
  listedAsOpen,
  reopenable,
  stillOpen,
  worksOn,
} from '@work/domain/services/conversations';
import { inboxSectionOf } from '@work/domain/services/inbox-section';
import { anyUnread } from '@work/domain/services/unread';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';
import { INBOX_REQUEST_FORMS } from '@work/domain/value-objects/inbox-request-form';
import {
  progressOfCurrentRun,
  type RunState,
} from '@work/domain/value-objects/run-state';
import {
  closesAConversation,
  hasAnUnseenAsk,
} from '@work/infrastructure/persistence/drizzle/readers/conversation-filters';
import { timeCursorOf } from '@work/infrastructure/persistence/drizzle/readers/page-cursor';
import {
  attachmentsFor,
  attachmentsOf,
  briefingsFor,
  type ConversationMark,
  conversationsAmong,
  failureIn,
  type MarkedConversation,
  marksFor,
  newestNotesFor,
  noteKey,
  notesAt,
  stationsPerLine,
  trailsFor,
} from '@work/infrastructure/persistence/drizzle/readers/task-trail';
import {
  inboxRequest,
  inboxRequestRead,
} from '@work/infrastructure/persistence/drizzle/schemas/inbox-request.schema';
import {
  line,
  station,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { notice } from '@work/infrastructure/persistence/drizzle/schemas/notice.schema';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import {
  task,
  taskNote,
} from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
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

const FORMS_FOR_TEAM_READERS = INBOX_REQUEST_FORMS.filter(
  (form) => InboxRequest.requiredAccess(form) === 'readsTeamInsights',
);

const PAGES_TO_SKIP_OVER = 5;

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

const tasksWhere = (
  db: DrizzleDatabase,
  workspaceId: string,
  assignee: UserId | null,
  narrowedTo: SQL,
) => {
  const origin = alias(station, 'origin');

  return db
    .select({
      taskId: task.id,
      teamId: line.teamId,
      title: task.title,
      description: task.description,
      lineId: line.id,
      originStationName: origin.name,
      originColor: origin.color,
      originPosition: origin.position,
      currentStationName: station.name,
      currentStationColor: station.color,
      currentStationPosition: station.position,
      createdAt: task.createdAt,
      finishedAt: task.finishedAt,
      working: task.currentRunId,
      workingState: run.state,
      workingStopRequestedAt: run.stopRequestedAt,
      workingSince: run.queuedAt,
    })
    .from(task)
    .innerJoin(station, eq(station.id, task.stationId))
    .leftJoin(run, eq(run.id, task.currentRunId))
    .innerJoin(line, eq(line.id, station.lineId))
    .leftJoin(origin, eq(origin.id, task.originStationId))
    .where(
      and(
        eq(task.workspaceId, workspaceId),
        assignee ? eq(task.assigneeId, assignee.value) : undefined,
        narrowedTo,
      ),
    );
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
      requestCreatedAt: inboxRequest.createdAt,
      cursorAt: sortableTime(inboxRequest.createdAt),
      readAt: inboxRequestRead.readAt,
      resolvedAt: inboxRequest.resolvedAt,
      taskId: task.id,
      assigneeId: task.assigneeId,
      teamId: line.teamId,
      lineId: line.id,
      title: task.title,
      description: task.description,
      createdAt: task.createdAt,
      currentStationName: station.name,
      currentStationColor: station.color,
      currentStationPosition: station.position,
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
    .innerJoin(station, eq(station.id, task.stationId))
    .innerJoin(line, eq(line.id, station.lineId))
    .where(
      and(
        eq(inboxRequest.workspaceId, workspaceId),
        or(
          eq(task.assigneeId, userId.value),
          isNull(task.assigneeId),
          inArray(inboxRequest.form, FORMS_FOR_TEAM_READERS),
        ),
        narrowedTo,
      ),
    )
    .orderBy(desc(inboxRequest.createdAt), desc(inboxRequest.id))
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
        or(eq(notice.addresseeId, userId.value), isNull(notice.addresseeId)),
        narrowedTo,
      ),
    )
    .orderBy(desc(notice.createdAt), desc(notice.id))
    .$dynamic();

  return limit === null ? query : query.limit(limit);
};

type TaskRow = Awaited<ReturnType<typeof tasksWhere>>[number];

interface TaskContext {
  readonly stationCounts: ReadonlyMap<string, number>;
  readonly attached: ReadonlyMap<string, { own: readonly AttachmentSummary[] }>;
  readonly briefings: ReadonlyMap<string, string>;
}

const workingOf = (row: {
  readonly workingState: RunState | null;
  readonly workingStopRequestedAt: Date | null;
}) =>
  row.workingState
    ? {
        state: row.workingState,
        stopRequested: row.workingStopRequestedAt !== null,
      }
    : null;

const positionsOf = (
  conversation: MarkedConversation<{ readonly position: number }>,
): Conversation => ({
  from: conversation.from.position,
  to: conversation.to?.position ?? null,
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
      ? progressOfCurrentRun(workingOf(row), true)
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
      opening.position,
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
  const progress = progressOfCurrentRun(workingOf(row), true);

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
    @Inject(WORKSPACE_ACCESS) private readonly access: WorkspaceAccessPort,
    @Inject(WORKSPACE_READER) private readonly workspaces: WorkspaceReaderPort,
    @Inject(PERSON_READER) private readonly people: PersonReaderPort,
  ) {}

  async openForWorkspaceMember(
    slug: string,
    userId: UserId,
  ): Promise<InboxEntrySummary[] | null> {
    const workspaceId = await this.visible(slug, userId);

    if (!workspaceId) {
      return null;
    }

    const [tasks, requests, notices] = await Promise.all([
      this.openTasks(workspaceId, userId),
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
    ]);
    const items: InboxEntrySummary[] = [
      ...tasks,
      ...(await this.requestItems(userId, requests)).map((each) => each.entry),
      ...(await this.noticeItems(userId, notices)).map((each) => each.entry),
    ];

    return items.sort((one, other) => +other.askedAt - +one.askedAt);
  }

  async resolvedForWorkspaceMember(
    slug: string,
    userId: UserId,
    page: PageRequest,
  ): Promise<Page<InboxEntrySummary> | null> {
    const workspaceId = await this.visible(slug, userId);

    if (!workspaceId) {
      return null;
    }

    let before = timeCursorOf(page.before);

    for (let skipped = 0; skipped < PAGES_TO_SKIP_OVER; skipped++) {
      const found = await this.resolvedPage(
        workspaceId,
        userId,
        before,
        page.limit,
      );

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

  async itemForWorkspaceMember(
    slug: string,
    userId: UserId,
    itemId: string,
  ): Promise<InboxItemView | null> {
    const workspaceId = await this.visible(slug, userId);

    if (!workspaceId) {
      return null;
    }

    const conversationId = ConversationId.tryParse(itemId);

    return conversationId
      ? this.conversationView(workspaceId, conversationId)
      : this.requestView(workspaceId, userId, itemId);
  }

  async noticeForWorkspaceMember(
    slug: string,
    userId: UserId,
    noticeId: string,
  ): Promise<InboxNoticeSummary | null> {
    const workspaceId = await this.visible(slug, userId);

    if (!workspaceId) {
      return null;
    }

    const rows = await noticesWhere(
      this.db,
      workspaceId,
      userId,
      eq(notice.id, noticeId),
      null,
    );
    const [found] = await this.noticeItems(userId, rows);

    return found && found.entry.kind === 'notice' ? found.entry : null;
  }

  private async visible(slug: string, userId: UserId): Promise<string | null> {
    const workspaceId = await this.workspaces.idForSlug(slug);

    return workspaceId &&
      (await this.access.mayView(userId, WorkspaceId.of(workspaceId)))
      ? workspaceId
      : null;
  }

  private async resolvedPage(
    workspaceId: string,
    userId: UserId,
    before: Cursor | null,
    limit: number,
  ): Promise<{ items: readonly Keyed[]; next: Cursor | null }> {
    const fetched = limit + 1;
    const sources = await Promise.all([
      this.resolvedConversations(workspaceId, userId, before, fetched),
      this.resolvedRequests(workspaceId, userId, before, fetched),
      this.resolvedNotices(workspaceId, userId, before, fetched),
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
    workspaceId: string,
    userId: UserId,
    before: Cursor | null,
    fetched: number,
  ): Promise<Gathered> {
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
          eq(task.assigneeId, userId.value),
          closesAConversation,
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
      workspaceId,
      userId,
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
    workspaceId: string,
    userId: UserId,
    before: Cursor | null,
    fetched: number,
  ): Promise<Gathered> {
    const rows = await requestsWhere(
      this.db,
      workspaceId,
      userId,
      and(
        isNotNull(inboxRequest.resolvedAt),
        before ? notNewerThan(inboxRequest.createdAt, before) : undefined,
      ),
      fetched,
    );

    return {
      keyed: await this.requestItems(userId, rows),
      floor: floorOf(rows, fetched, (each) => each.cursorAt),
    };
  }

  private async resolvedNotices(
    workspaceId: string,
    userId: UserId,
    before: Cursor | null,
    fetched: number,
  ): Promise<Gathered> {
    const rows = await noticesWhere(
      this.db,
      workspaceId,
      userId,
      and(
        isNotNull(notice.resolvedAt),
        before ? notNewerThan(notice.createdAt, before) : undefined,
      ),
      fetched,
    );

    return {
      keyed: await this.noticeItems(userId, rows),
      floor: floorOf(rows, fetched, (each) => each.cursorAt),
    };
  }

  private async openTasks(
    workspaceId: string,
    userId: UserId,
  ): Promise<(InboxItemSummary | InboxRunSummary)[]> {
    const rows = await tasksWhere(
      this.db,
      workspaceId,
      userId,
      sql`(${isNull(task.finishedAt)} or ${hasAnUnseenAsk})`,
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
    workspaceId: string,
    conversationId: ConversationId,
  ): Promise<InboxItemView | null> {
    const [row] = await tasksWhere(
      this.db,
      workspaceId,
      null,
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
    workspaceId: string,
    userId: UserId,
    requestId: string,
  ): Promise<InboxItemView | null> {
    const rows = await requestsWhere(
      this.db,
      workspaceId,
      userId,
      eq(inboxRequest.id, requestId),
      null,
    );
    const [found] = await this.requestItems(userId, rows);

    return found && found.entry.kind === 'task'
      ? { ...found.entry, notes: [] }
      : null;
  }

  private async contextFor(
    rows: readonly TaskRow[],
    conversations: readonly MarkedConversation<ConversationMark>[],
  ): Promise<TaskContext> {
    const [stationCounts, attached, briefings] = await Promise.all([
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
    ]);

    return { stationCounts, attached, briefings };
  }

  private async requestItems(
    userId: UserId,
    rows: readonly RequestRow[],
  ): Promise<Keyed[]> {
    const needing = (access: InboxRequestAccess) =>
      rows.filter((row) => InboxRequest.requiredAccess(row.form) === access);

    const onTeam = new Map(
      await Promise.all(
        [
          ...new Set(
            needing('seesTeam')
              .filter((row) => row.assigneeId === null)
              .map((row) => row.teamId),
          ),
        ].map(
          async (teamId) =>
            [
              teamId,
              (await this.access.onTeam(teamId, userId)) !== null,
            ] as const,
        ),
      ),
    );

    const readerOf = new Map(
      await Promise.all(
        [...new Set(needing('readsTeamInsights').map((row) => row.teamId))].map(
          async (teamId) =>
            [
              teamId,
              (await this.access.permissionsAsTeamReader(
                teamId,
                PersonPrincipal.of(userId),
              )) !== null,
            ] as const,
        ),
      ),
    );

    const attending = rows.filter((row) =>
      InboxRequest.visibleTo({
        form: row.form,
        viewer: userId,
        assignee: row.assigneeId ? UserId.of(row.assigneeId) : null,
        seesTeam: onTeam.get(row.teamId) ?? false,
        readsTeamInsights: readerOf.get(row.teamId) ?? false,
      }),
    );

    if (attending.length === 0) {
      return [];
    }

    const [attached, stationCounts] = await Promise.all([
      attachmentsFor(
        this.db,
        attending.map((row) => row.taskId),
      ),
      stationsPerLine(
        this.db,
        attending.map((row) => row.lineId),
      ),
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
          currentStation,
          createdAt: row.createdAt,
          askedAt: row.requestCreatedAt,
          resolved: row.resolvedAt !== null,
          section: inboxSectionOf({
            unread: row.readAt === null && row.resolvedAt === null,
            resolved: row.resolvedAt !== null,
            running: false,
          }),
          reopenable: InboxRequest.reopenable(row.resolvedAt),
          progress: null,
          runId: null,
          unread: row.readAt === null && row.resolvedAt === null,
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
    userId: UserId,
    rows: readonly NoticeRow[],
  ): Promise<Keyed[]> {
    const onTeam = new Map(
      await Promise.all(
        [...new Set(rows.map((row) => row.notice.teamId))].map(
          async (teamId) =>
            [
              teamId,
              (await this.access.onTeam(teamId, userId)) !== null,
            ] as const,
        ),
      ),
    );

    return rows
      .filter((row) => onTeam.get(row.notice.teamId))
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
            unread: row.resolvedAt === null,
            resolved: row.resolvedAt !== null,
            section: inboxSectionOf({
              unread: row.resolvedAt === null,
              resolved: row.resolvedAt !== null,
              running: false,
            }),
            reopenable: Notice.reopenable(row.resolvedAt),
          },
          cursorAt,
        ),
      );
  }
}
