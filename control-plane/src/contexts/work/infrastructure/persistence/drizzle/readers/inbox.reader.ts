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
import { timeCursorOf } from '@platform/persistence/drizzle/page-cursor';
import {
  RUN_PROGRESS,
  type RunProgressPort,
} from '@runs/application/ports/run-progress.port';
import type { Page } from '@shared-kernel/application/dto/page.dto';
import { firstOf, itemAt } from '@shared-kernel/domain/item-at';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { PageRequest } from '@work/application/dto/page.dto';
import { RunReadingMapper } from '@work/application/mappers/run-reading.mapper';
import { RunWaitingMapper } from '@work/application/mappers/run-waiting.mapper';
import type { AttachmentSummary } from '@work/application/ports/attachment-reader.port';
import type {
  InboxChatSummary,
  InboxEntrySummary,
  InboxItemView,
  InboxNote,
  InboxNoticeSummary,
  InboxReaderPort,
  InboxRunSummary,
  InboxScope,
} from '@work/application/ports/inbox-reader.port';
import { inboxSectionOf } from '@work/application/read-models/inbox-section';
import {
  type Grouped,
  groupOf,
  type PartItem,
  type Piece,
  type TaskPieces,
} from '@work/application/read-models/task-inbox-item';
import {
  InboxRequest,
  type InboxRequestAudience,
  type InboxRequestVisibility,
} from '@work/domain/aggregates/inbox-request.aggregate';
import {
  Notice,
  type NoticeAudience,
  type NoticeStanding,
} from '@work/domain/aggregates/notice.aggregate';
import {
  chatInboxStanding,
  chatProgress,
} from '@work/domain/services/chat-inbox';
import {
  ConversationAudience,
  type ConversationStanding,
  type OpenAsk,
  type RunStanding,
} from '@work/domain/services/conversation-audience';
import {
  type Conversation,
  lastAskIn,
  reopenable,
  openAskIn,
  stillOpen,
  TURNING_NOTE_KINDS,
  unreadIn,
  worksOn,
} from '@work/domain/services/conversations';
import { HoldRights } from '@work/domain/services/hold-rights';
import {
  RunStopPolicy,
  type StoppableRun,
} from '@work/domain/services/run-stop-policy';
import { TaskInbox } from '@work/domain/services/task-inbox';
import { unread as unreadNote } from '@work/domain/services/unread';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { progressOfCurrentRun } from '@work/domain/value-objects/progress';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import {
  chatResolvedWhere,
  chatUnresolvedWhere,
  chatInboxFacts,
  chatInboxFactsOf,
} from '@work/infrastructure/persistence/drizzle/readers/chat-inbox-state';
import { currentRunsOf } from '@work/infrastructure/persistence/drizzle/readers/current-progress';
import {
  attachmentsFor,
  attachmentsOf,
  briefingsFor,
  type ConversationMark,
  conversationsAmong,
  failureIn,
  foldedAround,
  latestRunsAtCurrentStation,
  type MarkedConversation,
  marksFor,
  newestNotesFor,
  noteKey,
  notesAt,
  openAskOf,
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
  taskHold,
  taskNote,
} from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { workStation } from '@work/infrastructure/persistence/drizzle/schemas/work-station.schema';
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import { alias, type AnyPgColumn } from 'drizzle-orm/pg-core';

const PAGES_TO_SKIP_OVER = 5;

const requestAudience = (audience: InboxRequestAudience): SQL | undefined =>
  or(
    eq(inboxRequest.askedOfId, audience.askedOf.value),
    and(
      isNull(inboxRequest.askedOfId),
      or(
        eq(task.assigneeId, audience.assignee.value),
        audience.unassigned ? isNull(task.assigneeId) : undefined,
        audience.formsForTeamActors.length > 0
          ? inArray(inboxRequest.form, [...audience.formsForTeamActors])
          : undefined,
      ),
    ),
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

interface Ranked {
  readonly entry: InboxEntrySummary;
  readonly arrivedAt: Date;
  readonly interactedAt: Date;
}

const rankedAt = (
  entry: InboxEntrySummary,
  arrivedAt: Date = entry.askedAt,
  interactedAt: Date = entry.askedAt,
): Ranked => ({ entry, arrivedAt, interactedAt });

const laterOf = (one: Date, other: Date | null | undefined): Date =>
  other && other > one ? other : one;

const rankingTime = (ranked: Ranked): number =>
  +(ranked.entry.section === 'open' ? ranked.arrivedAt : ranked.interactedAt);

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
  const last = itemAt(rows, rows.length - 1);

  return rows.length === fetched && last !== undefined ? at(last) : null;
};

const inTeamsSeen = (scope: InboxScope): SQL =>
  scope.teamsSeen.size > 0
    ? inArray(workStation.teamId, [...scope.teamsSeen])
    : sql`false`;

const wroteInBy = (viewer: UserId): SQL =>
  sql`exists (select 1 from ${taskNote} where ${taskNote.taskId} = ${task.id} and ${taskNote.voice} = 'person' and (${taskNote.authorId} = ${viewer.value} or ${viewer.value} = any(${taskNote.coAuthorIds})))`;

const openlyAskedBy = (viewer: UserId): SQL =>
  sql`exists (select 1 from ${taskNote} where ${taskNote.taskId} = ${task.id} and ((${taskNote.approval}->>'askedOf' = ${viewer.value} and ${taskNote.approval}->>'status' = 'pending') or (${taskNote.connectionAsk}->>'personId' = ${viewer.value} and (${taskNote.connectionAsk}->>'met')::boolean = false)))`;

const openAsksOf = async (
  db: DrizzleDatabase,
  taskIds: readonly string[],
): Promise<Map<string, OpenAsk>> => {
  if (taskIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      taskId: taskNote.taskId,
      kind: taskNote.kind,
      approval: taskNote.approval,
      connectionAsk: taskNote.connectionAsk,
    })
    .from(taskNote)
    .where(
      and(
        inArray(taskNote.taskId, [...taskIds]),
        inArray(taskNote.kind, [...TURNING_NOTE_KINDS]),
      ),
    )
    .orderBy(asc(taskNote.taskId), asc(taskNote.position));
  const byTask = new Map<string, (typeof rows)[number][]>();

  for (const row of rows) {
    byTask.set(row.taskId, [...(byTask.get(row.taskId) ?? []), row]);
  }

  return new Map(
    [...byTask].flatMap(([taskId, notes]) => {
      const ask = openAskIn(notes);

      return ask ? [[taskId, openAskOf(ask)] as const] : [];
    }),
  );
};

const inTeamsJoined = (scope: InboxScope): SQL =>
  scope.teamsJoined.size > 0
    ? inArray(workStation.teamId, [...scope.teamsJoined])
    : sql`false`;

const teamStandingOf = (scope: InboxScope, teamId: string): TeamStanding =>
  TeamStanding.of({
    seesTeam: scope.teamsSeen.has(teamId),
    actsOnTeam: scope.teamsActedOn.has(teamId),
    memberOfTeam: scope.teamsJoined.has(teamId),
  });

const noticeStandingOf = (
  scope: InboxScope,
  teamId: string | null,
): NoticeStanding =>
  teamId === null
    ? { kind: 'workspace', isAdmin: scope.isAdmin }
    : { kind: 'team', team: teamStandingOf(scope, teamId) };

const drivesHold = (
  scope: InboxScope,
  row: {
    readonly teamId: string;
    readonly heldBy: string | null;
    readonly heldForChat: string | null;
  },
): boolean =>
  row.heldBy !== null &&
  HoldRights.drives(
    {
      chat: nonEmpty(row.heldForChat) ? ChatId.of(row.heldForChat) : null,
    },
    { person: scope.viewer, team: teamStandingOf(scope, row.teamId) },
  );

const standingOf = (
  scope: InboxScope,
  row: {
    readonly teamId: string;
    readonly assigneeId: string | null;
    readonly wroteIn: boolean;
  },
  ask: OpenAsk | null,
): ConversationStanding | null =>
  ConversationAudience.standingOf(
    nonEmpty(row.assigneeId) ? UserId.of(row.assigneeId) : null,
    {
      person: scope.viewer,
      takesTasks: teamStandingOf(scope, row.teamId).takesTasks,
      wroteIn: row.wroteIn,
      asked: ConversationAudience.asks(ask, scope.viewer),
    },
  );

const taskRowsWhere = (
  db: DrizzleDatabase,
  scope: InboxScope,
  narrowedTo: SQL,
) => {
  const origin = alias(workStation, 'origin');
  const wroteIn = wroteInBy(scope.viewer);
  const openlyAsked = openlyAskedBy(scope.viewer);

  return db
    .select({
      taskId: task.id,
      assigneeId: task.assigneeId,
      wroteIn: sql<boolean>`${wroteIn}`,
      heldBy: taskHold.heldBy,
      heldForChat: taskHold.chatId,
      openlyAsked: sql<boolean>`${openlyAsked}`,
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
    .leftJoin(
      taskHold,
      and(eq(taskHold.taskId, task.id), isNull(taskHold.endedAt)),
    )
    .where(
      and(
        eq(task.workspaceId, scope.workspaceId),
        or(
          eq(task.assigneeId, scope.viewer.value),
          and(isNull(task.assigneeId), inTeamsJoined(scope)),
          wroteIn,
          openlyAsked,
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
    ...new Set(
      rows.flatMap((row) => (nonEmpty(row.working) ? [row.working] : [])),
    ),
  ];
  const facts = new Map(
    (ids.length === 0 ? [] : await progress.progressOf(ids.map(RunId.of))).map(
      (each) => [each.runId.value, each],
    ),
  );
  const asks = await openAsksOf(
    db,
    rows.flatMap((row) =>
      row.openlyAsked && row.assigneeId !== scope.viewer.value
        ? [row.taskId]
        : [],
    ),
  );

  return rows.flatMap((row) => {
    const working = nonEmpty(row.working) ? facts.get(row.working) : undefined;
    const standing = standingOf(scope, row, asks.get(row.taskId) ?? null);

    return standing
      ? [
          {
            ...row,
            standing,
            drives: drivesHold(scope, row),
            team: teamStandingOf(scope, row.teamId),
            workingReading: RunReadingMapper.reading(working ?? null),
            workingWait: RunWaitingMapper.toDto(working?.waiting ?? null),
            workingSince: working?.queuedAt ?? null,
          },
        ]
      : [];
  });
};

const requestsWhere = (
  db: DrizzleDatabase,
  workspaceId: string,
  userId: UserId,
  narrowedTo: SQL | undefined,
  limit: number | null,
  orderedBy: AnyPgColumn = inboxRequest.openedAt,
) => {
  const query = db
    .select({
      id: inboxRequest.id,
      form: inboxRequest.form,
      about: inboxRequest.about,
      asks: inboxRequest.asks,
      askedOfId: inboxRequest.askedOfId,
      requestOpenedAt: inboxRequest.openedAt,
      cursorAt: sortableTime(orderedBy),
      readAt: inboxRequestRead.readAt,
      resolvedAt: inboxRequest.resolvedAt,
      resolvedByAPerson: inboxRequest.resolvedByAPerson,
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
    // Ties break by task as the grouped rows' cursors do, so a page that
    // stops inside one instant picks up the rest of it on the next.
    .orderBy(desc(orderedBy), desc(inboxRequest.taskId), desc(inboxRequest.id))
    .$dynamic();

  return limit === null ? query : query.limit(limit);
};

const noticesWhere = (
  db: DrizzleDatabase,
  workspaceId: string,
  userId: UserId,
  narrowedTo: SQL | undefined,
  limit: number | null,
  orderedBy: AnyPgColumn = notice.createdAt,
) => {
  const query = db
    .select({ notice, cursorAt: sortableTime(orderedBy) })
    .from(notice)
    .where(
      and(
        eq(notice.workspaceId, workspaceId),
        noticeAudience(Notice.audienceOf(userId)),
        narrowedTo,
      ),
    )
    .orderBy(desc(orderedBy), desc(notice.id))
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
      currentRunId: chat.currentRunId,
      createdAt: chat.createdAt,
      reopenedAt: chat.reopenedAt,
      resolvedAt: chat.resolvedAt,
      readAt: chat.readAt,
      cursorAt: sortableTime(chat.resolvedAt).mapWith(
        (value: string | null) => value,
      ),
      lastAt:
        sql<Date>`(select max("chat_message"."at") from "chat_message" where "chat_message"."chat_id" = "chat"."id")`.mapWith(
          (value: string) => new Date(value),
        ),
      openProposals:
        sql<number>`(select count(*) from "chat_message" where "chat_message"."chat_id" = "chat"."id" and "chat_message"."kind" = 'proposed' and "chat_message"."proposal"->>'state' = 'open')`.mapWith(
          Number,
        ),
      ...chatInboxFacts,
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
  const latest = itemAt(conversations, conversations.length - 1);

  return latest === undefined ? null : positionsOf(latest);
};

const closingOf = (
  conversation: MarkedConversation<{ readonly position: number }>,
  lastNote: InboxNote | null,
) =>
  lastNote && lastNote.position === conversation.to?.position
    ? { form: lastNote.form, byAPerson: lastNote.voice === 'person' }
    : null;

const stoppableRunOf = (row: TaskRow): StoppableRun => ({
  stationId: StationId.of(row.currentStationId),
  taskId: TaskId.of(row.taskId),
});

const briefingOf = (
  runId: string | null,
  briefings: ReadonlyMap<string, string>,
): string | null => {
  if (!nonEmpty(runId)) {
    return null;
  }

  const briefing = briefings.get(runId);

  return !nonEmpty(briefing) ? null : briefing;
};

const conversationItem = (
  row: TaskRow,
  conversation: MarkedConversation<ConversationMark>,
  latest: Conversation | null,
  lastNote: InboxNote | null,
  context: TaskContext,
): PartItem => {
  const opening = conversation.from;
  const open = stillOpen(conversation);
  const last = itemAt(conversation.notes, conversation.notes.length - 1);
  const progress =
    open && worksOn(row.working !== null, conversation.notes)
      ? progressOfCurrentRun(row.workingReading, true)
      : null;
  const unread =
    ConversationAudience.notifies(row.standing) &&
    unreadIn(conversation, row.finishedAt !== null);

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
    stationPosition: opening.stationPosition ?? 0,
    stationCount: context.stationCounts.get(row.lineId) ?? 1,
    originStation: {
      name: row.originStationName ?? opening.station,
      color: row.originColor ?? opening.stationColor,
      position: row.originPosition ?? opening.stationPosition ?? 0,
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
      following: row.standing === 'following',
    }),
    standing: row.standing,
    answerable: open && ConversationAudience.mayAnswer(row.team, row),
    resolvable: open && ConversationAudience.mayResolve(row.team, row),
    reopenable:
      ConversationAudience.mayAnswer(row.team, row) &&
      reopenable(
        NotePosition.of(opening.position),
        latest,
        closingOf(conversation, lastNote),
      ),
    progress,
    waiting: progress === 'queued' ? row.workingWait : null,
    runId: open ? row.working : null,
    stoppableByYou:
      open &&
      row.working !== null &&
      RunStopPolicy.allows(
        stoppableRunOf(row),
        { id: TaskId.of(row.taskId) },
        row.team,
      ),
    unread,
    briefing: briefingOf(opening.runId, context.briefings),
    failure: failureIn(conversation.notes),
    lastNote,
  };
};

const conversationPiece = (
  item: PartItem,
  conversation: MarkedConversation<ConversationMark>,
  resolutionKey: string | null,
): Piece => {
  const firstUnread = item.unread
    ? conversation.notes.find(unreadNote)
    : undefined;

  return {
    item,
    part: {
      id: item.id,
      kind: TaskInbox.kindOfConversation(item.failure !== null),
      form: null,
      about: null,
      asks: 1,
      open: !item.resolved,
      waits: !item.resolved && item.progress === null,
      unread: item.unread,
      unreadSince: firstUnread?.at ?? null,
      arrivedAt: (lastAskIn(conversation.notes) ?? conversation.from).at,
      interactedAt: item.askedAt,
      resolvedAt: conversation.to?.at ?? null,
      resolvable: item.resolvable,
      reopenable: item.reopenable,
    },
    firstUnreadAt: firstUnread?.position ?? null,
    resolutionKey: item.resolved ? resolutionKey : null,
  };
};

const runItem = (
  row: TaskRow,
  standing: RunStanding,
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
        waiting: progress === 'queued' ? row.workingWait : null,
        askedAt: row.workingSince ?? row.createdAt,
        unread: false,
        unreadCount: 0,
        resolved: false,
        section: inboxSectionOf({
          unread: false,
          resolved: false,
          running: true,
          following: standing === 'following',
        }),
        standing,
        reopenable: false,
        stoppableByYou: RunStopPolicy.allows(
          stoppableRunOf(row),
          { id: TaskId.of(row.taskId) },
          row.team,
        ),
      }
    : null;
};

type RequestRow = Awaited<ReturnType<typeof requestsWhere>>[number];

const requestVisibilityOf = (
  scope: InboxScope,
  row: RequestRow,
): InboxRequestVisibility => ({
  form: row.form,
  viewer: scope.viewer,
  assignee: nonEmpty(row.assigneeId) ? UserId.of(row.assigneeId) : null,
  askedOf: nonEmpty(row.askedOfId) ? UserId.of(row.askedOfId) : null,
  team: teamStandingOf(scope, row.teamId),
});

type NoticeRow = Awaited<ReturnType<typeof noticesWhere>>[number];

const closingKeysOf = async (
  db: DrizzleDatabase,
  taskIds: readonly string[],
): Promise<Map<string, string>> => {
  if (taskIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      taskId: taskNote.taskId,
      position: taskNote.position,
      key: sortableTime(taskNote.at),
    })
    .from(taskNote)
    .where(
      and(
        inArray(taskNote.taskId, [...taskIds]),
        eq(taskNote.closesConversation, true),
      ),
    );

  return new Map(rows.map((each) => [noteKey(each), each.key] as const));
};

const unique = (ids: readonly string[]): string[] => [...new Set(ids)];

interface Sighted {
  readonly taskIds: readonly string[];
  readonly floor: string | null;
}

interface TasksAmong {
  readonly tasks: SQL;
  readonly requests: SQL;
}

const amongTasks = (taskIds: readonly string[]): TasksAmong =>
  taskIds.length === 0
    ? { tasks: sql`false`, requests: sql`false` }
    : {
        tasks: inArray(task.id, [...taskIds]),
        requests: inArray(inboxRequest.taskId, [...taskIds]),
      };

const openRequestOn = sql`exists (select 1 from ${inboxRequest} where ${inboxRequest.taskId} = ${task.id} and ${inboxRequest.resolvedAt} is null)`;

// Only narrows the read: TaskInbox decides what is listed as open, and a
// finished task with no open inbox request has nothing open or unread left.
// Every request of a task read is a part of its item, answered ones too.
const listable = or(isNull(task.finishedAt), openRequestOn) ?? sql`false`;

const named = alias(inboxRequest, 'named');

const candidatesOf = (itemId: string): string[] =>
  unique([itemId, ConversationId.tryParse(itemId)?.taskId.value ?? itemId]);

const amongItem = (db: DrizzleDatabase, itemId: string): TasksAmong => {
  const requested = db
    .select({ taskId: named.taskId })
    .from(named)
    .where(eq(named.id, itemId));

  return {
    tasks:
      or(inArray(task.id, candidatesOf(itemId)), inArray(task.id, requested)) ??
      sql`false`,
    requests:
      or(
        inArray(inboxRequest.taskId, candidatesOf(itemId)),
        inArray(inboxRequest.taskId, requested),
      ) ?? sql`false`,
  };
};

// The item an id opens: a task id, then an inbox request on a task, then
// a conversation, so links from before items were grouped by task still work.
const taskOfItem = (
  found: ReadonlyMap<string, TaskPieces>,
  itemId: string,
): string | null => {
  if (found.has(itemId)) {
    return itemId;
  }

  const requested = [...found.values()]
    .flatMap((each) => each.pieces)
    .find((each) => each.part.id === itemId);
  const conversation = ConversationId.tryParse(itemId)?.taskId.value;

  return (
    requested?.item.taskId ??
    (conversation !== undefined && found.has(conversation)
      ? conversation
      : null)
  );
};

@Injectable()
export class DrizzleInboxReader implements InboxReaderPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(PERSON_READER) private readonly people: PersonReaderPort,
    @Inject(RUN_PROGRESS) private readonly progress: RunProgressPort,
  ) {}

  async open(scope: InboxScope): Promise<InboxEntrySummary[]> {
    const { workspaceId, viewer: userId } = scope;

    const [tasks, notices, chats] = await Promise.all([
      this.tasksIn(scope, { tasks: listable, requests: listable }),
      noticesWhere(
        this.db,
        workspaceId,
        userId,
        isNull(notice.resolvedAt),
        null,
      ),
      chatsWhere(this.db, scope, chatUnresolvedWhere, null).then(
        async (rows) => ({ rows, items: await this.chatItems(rows) }),
      ),
    ]);
    const chatEntries = chats.items;
    const items: Ranked[] = [
      ...[...tasks.values()].flatMap((found): Ranked[] => {
        const group = groupOf(found);

        if (group?.listedAsOpen) {
          return [rankedAt(group.item, group.arrivedAt, group.interactedAt)];
        }

        return found.run
          ? [
              rankedAt(
                found.run,
                found.run.askedAt,
                found.newestAt ?? found.run.askedAt,
              ),
            ]
          : [];
      }),
      ...this.noticeItems(scope, notices).map((each) => rankedAt(each.entry)),
      ...chatEntries.map((each, place) =>
        rankedAt(
          each.entry,
          chats.rows[place]?.createdAt,
          laterOf(each.entry.askedAt, chats.rows[place]?.reopenedAt),
        ),
      ),
    ];

    return items
      .sort((one, other) => rankingTime(other) - rankingTime(one))
      .map((each) => each.entry);
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
    const [found, trails] = await Promise.all([
      this.tasksIn(scope, amongItem(this.db, itemId)),
      trailsFor(this.db, this.people, candidatesOf(itemId)),
    ]);
    const taskId = taskOfItem(found, itemId);
    const pieces = taskId === null ? undefined : found.get(taskId);
    const named = pieces?.pieces.find((each) => each.part.id === itemId);
    const conversationNamed =
      named === undefined && ConversationId.tryParse(itemId) !== null;
    const group =
      pieces && !conversationNamed ? groupOf(pieces, named?.part.id) : null;

    if (!group) {
      return (
        (await this.unlistedConversation(scope, itemId)) ??
        (pieces ? this.withNotes(groupOf(pieces), trails) : null)
      );
    }

    return this.withNotes(group, trails);
  }

  private async withNotes(
    group: Grouped | null,
    trails: ReadonlyMap<string, InboxNote[]>,
  ): Promise<InboxItemView | null> {
    if (!group) {
      return null;
    }

    const conversationId = nonEmpty(group.item.conversationId)
      ? ConversationId.parse(group.item.conversationId)
      : null;
    const trail = conversationId
      ? (trails.get(group.item.taskId) ??
        (await trailsFor(this.db, this.people, [group.item.taskId])).get(
          group.item.taskId,
        ) ??
        [])
      : [];
    const notes =
      conversationsAmong(trail).find(
        (each) => each.from.position === conversationId?.from.value,
      )?.notes ?? [];

    return {
      ...group.item,
      notes,
      folded: notes.length > 0 ? foldedAround(trail, notes) : [],
    };
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
    const found = firstOf(this.noticeItems(scope, rows));

    return found?.entry.kind === 'notice' ? found.entry : null;
  }

  private async resolvedPage(
    scope: InboxScope,
    before: Cursor | null,
    limit: number,
  ): Promise<{ items: readonly Keyed[]; next: Cursor | null }> {
    const fetched = limit + 1;
    const [conversations, requests, notices, chats] = await Promise.all([
      this.resolvedConversations(scope, before, fetched),
      this.resolvedRequests(scope, before, fetched),
      this.resolvedNotices(scope, before, fetched),
      this.resolvedChats(scope, before, fetched),
    ]);
    const tasks = await this.tasksIn(
      scope,
      amongTasks(unique([...conversations.taskIds, ...requests.taskIds])),
    );
    const groups = [...tasks.values()].flatMap((found): Keyed[] => {
      const group = groupOf(found);

      // A resolved item is listed here though it is still unread, as it was
      // before items were grouped; the web shows it once, where it is open.
      return group?.item.resolved === true && nonEmpty(group.resolutionKey)
        ? [keyedAt(group.item, group.resolutionKey)]
        : [];
    });
    const floors = [conversations, requests, notices, chats].flatMap((each) =>
      nonEmpty(each.floor) ? [each.floor] : [],
    );
    const floor = itemAt(floors.sort(), floors.length - 1) ?? null;
    const shown = [...groups, ...notices.keyed, ...chats.keyed]
      .filter(
        (each) =>
          (!before || newer(before, each.cursor)) &&
          (floor === null || each.cursor.key >= floor),
      )
      .sort((one, other) => (newer(one.cursor, other.cursor) ? -1 : 1));
    const items = shown.slice(0, limit);
    const last = itemAt(items, items.length - 1);
    const more = shown.length > limit || floor !== null;

    if (!more) {
      return { items, next: null };
    }

    return {
      items,
      next:
        last !== undefined
          ? last.cursor
          : nonEmpty(floor)
            ? { key: floor, id: '' }
            : null,
    };
  }

  private async resolvedConversations(
    scope: InboxScope,
    before: Cursor | null,
    fetched: number,
  ): Promise<Sighted> {
    const closing = await this.db
      .select({
        taskId: taskNote.taskId,
        cursorAt: sortableTime(taskNote.at),
      })
      .from(taskNote)
      .innerJoin(task, eq(task.id, taskNote.taskId))
      .where(
        and(
          eq(task.workspaceId, scope.workspaceId),
          eq(task.assigneeId, scope.viewer.value),
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

    return {
      taskIds: unique(closing.map((each) => each.taskId)),
      floor: floorOf(closing, fetched, (each) => each.cursorAt),
    };
  }

  private async resolvedRequests(
    scope: InboxScope,
    before: Cursor | null,
    fetched: number,
  ): Promise<Sighted> {
    const rows = await requestsWhere(
      this.db,
      scope.workspaceId,
      scope.viewer,
      and(
        isNotNull(inboxRequest.resolvedAt),
        before ? notNewerThan(inboxRequest.resolvedAt, before) : undefined,
      ),
      fetched,
      inboxRequest.resolvedAt,
    );

    return {
      taskIds: unique(
        rows
          .filter((row) =>
            InboxRequest.visibleTo(requestVisibilityOf(scope, row)),
          )
          .map((row) => row.taskId),
      ),
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
        before ? notNewerThan(notice.resolvedAt, before) : undefined,
      ),
      fetched,
      notice.resolvedAt,
    );

    return {
      keyed: this.noticeItems(scope, rows),
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
        chatResolvedWhere,
        before ? notNewerThan(chat.resolvedAt, before) : undefined,
      ),
      fetched,
    );

    return {
      keyed: await this.chatItems(rows),
      floor: floorOf(rows, fetched, (each) => each.cursorAt ?? ''),
    };
  }

  // Everything that waits on the viewer, per task: the task's conversations
  // and every inbox request raised about it, answered ones included.
  private async tasksIn(
    scope: InboxScope,
    among: TasksAmong,
  ): Promise<Map<string, TaskPieces>> {
    const [conversations, requests] = await Promise.all([
      tasksWhere(this.db, this.progress, scope, among.tasks).then((rows) =>
        this.conversationPieces(rows),
      ),
      requestsWhere(
        this.db,
        scope.workspaceId,
        scope.viewer,
        among.requests,
        null,
        inboxRequest.resolvedAt,
      ).then((rows) => this.requestPieces(scope, rows)),
    ]);
    const taskIds = unique([
      ...conversations.keys(),
      ...requests.map((each) => each.item.taskId),
    ]);

    return new Map(
      taskIds.map((taskId) => {
        const own = conversations.get(taskId);

        return [
          taskId,
          {
            pieces: [
              ...(own?.pieces ?? []),
              ...requests.filter((each) => each.item.taskId === taskId),
            ],
            run: own?.run ?? null,
            newestAt: own?.newestAt ?? null,
          },
        ] as const;
      }),
    );
  }

  private async conversationPieces(
    rows: readonly TaskRow[],
  ): Promise<Map<string, TaskPieces>> {
    const taskIds = rows.map((row) => row.taskId);
    const [marks, newest, closingKeys] = await Promise.all([
      marksFor(this.db, taskIds),
      newestNotesFor(this.db, this.people, taskIds),
      closingKeysOf(this.db, taskIds),
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
    const held = new Map(
      rows.map(
        (row) =>
          [
            row.taskId,
            (all.get(row.taskId) ?? []).filter((conversation) =>
              TaskInbox.holdsConversation(
                { open: stillOpen(conversation) },
                { finished: row.finishedAt !== null },
                row.standing,
              ),
            ),
          ] as const,
      ),
    );
    const conversations = [...held.values()].flat();
    const [context, closingNotes] = await Promise.all([
      this.contextFor(rows, conversations),
      notesAt(
        this.db,
        this.people,
        rows.flatMap((row) =>
          (held.get(row.taskId) ?? []).flatMap((conversation) =>
            conversation.to
              ? [{ taskId: row.taskId, position: conversation.to.position }]
              : [],
          ),
        ),
      ),
    ]);

    return new Map(
      rows.map((row) => {
        const listed = held.get(row.taskId) ?? [];
        const latest = latestOf(all.get(row.taskId) ?? []);
        const pieces = listed.map((conversation) => {
          const closing = conversation.to
            ? noteKey({
                taskId: row.taskId,
                position: conversation.to.position,
              })
            : null;

          return conversationPiece(
            conversationItem(
              row,
              conversation,
              latest,
              closing === null
                ? (newest.get(row.taskId) ?? null)
                : (closingNotes.get(closing) ?? null),
              context,
            ),
            conversation,
            closing === null ? null : (closingKeys.get(closing) ?? null),
          );
        });
        const run =
          nonEmpty(row.working) &&
          ConversationAudience.listsRuns(row.standing) &&
          !pieces.some((each) => each.part.open)
            ? runItem(row, row.standing, row.working, context)
            : null;

        return [
          row.taskId,
          { pieces, run, newestAt: newest.get(row.taskId)?.at ?? null },
        ] as const;
      }),
    );
  }

  // A link to a conversation that is no longer part of the viewer's inbox
  // item, such as one from a chat notice, still opens it.
  private async unlistedConversation(
    scope: InboxScope,
    itemId: string,
  ): Promise<InboxItemView | null> {
    const conversationId = ConversationId.tryParse(itemId);
    const row =
      conversationId &&
      firstOf(
        await tasksWhere(
          this.db,
          this.progress,
          scope,
          eq(task.id, conversationId.taskId.value),
        ),
      );

    if (!conversationId || !row) {
      return null;
    }

    const shown = await this.conversationNotes(scope, conversationId, row);

    if (!shown) {
      return null;
    }

    const group = groupOf({
      pieces: [
        conversationPiece(
          conversationItem(
            row,
            shown.conversation,
            shown.latest,
            shown.notes[shown.notes.length - 1] ?? null,
            shown.context,
          ),
          shown.conversation,
          null,
        ),
      ],
      run: null,
      newestAt: null,
    });

    // Not part of the viewer's item for the task, so it keeps its own id.
    return (
      group && {
        ...group.item,
        id: conversationId.value,
        notes: shown.notes,
        folded: shown.folded,
      }
    );
  }

  private async conversationNotes(
    scope: InboxScope,
    conversationId: ConversationId,
    known?: TaskRow,
  ) {
    const row =
      known ??
      firstOf(
        await tasksWhere(
          this.db,
          this.progress,
          scope,
          eq(task.id, conversationId.taskId.value),
        ),
      );

    if (row === undefined) {
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

    return {
      conversation,
      latest: latestOf(conversations),
      context: await this.contextFor([row], [conversation]),
      notes: conversation.notes,
      folded: foldedAround(trail, conversation.notes),
    };
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
          nonEmpty(each.from.runId) ? [each.from.runId] : [],
        ),
      ),
      latestRunsAtCurrentStation(this.db, rows.map(placeOf)),
    ]);

    return { stationCounts, attached, briefings, latestRuns };
  }

  private async requestPieces(
    scope: InboxScope,
    rows: readonly RequestRow[],
  ): Promise<Piece[]> {
    const attending = rows.filter((row) =>
      InboxRequest.visibleTo(requestVisibilityOf(scope, row)),
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

    return attending.map((row): Piece => {
      const currentStation = {
        name: row.currentStationName,
        color: row.currentStationColor,
        position: row.currentStationPosition,
      };
      const team = teamStandingOf(scope, row.teamId);
      const unread = InboxRequest.unread(row);
      const resolvable = InboxRequest.resolvableBy(team, row.resolvedAt);
      const reopenable = InboxRequest.reopenableBy(team, row.resolvedAt);
      const reopensWithItem = InboxRequest.reopensWithItem(team, {
        at: row.resolvedAt,
        byAPerson: row.resolvedByAPerson,
      });

      return {
        item: {
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
            unread,
            resolved: row.resolvedAt !== null,
            running: false,
            following: false,
          }),
          standing: InboxRequest.standingOf(requestVisibilityOf(scope, row)),
          answerable: false,
          resolvable,
          reopenable,
          progress: null,
          waiting: null,
          runId: null,
          stoppableByYou: false,
          unread,
          briefing: null,
          failure: null,
          lastNote: null,
        },
        part: {
          id: row.id,
          kind: TaskInbox.kindOfRequest(row.form),
          form: row.form,
          about: row.about,
          asks: row.asks,
          open: row.resolvedAt === null,
          waits: row.resolvedAt === null,
          unread,
          unreadSince: unread ? row.requestOpenedAt : null,
          arrivedAt: row.requestOpenedAt,
          interactedAt: row.resolvedAt ?? row.requestOpenedAt,
          resolvedAt: row.resolvedAt,
          resolvable,
          reopenable: reopensWithItem,
        },
        firstUnreadAt: null,
        resolutionKey: row.resolvedAt === null ? null : row.cursorAt,
      };
    });
  }

  private noticeItems(scope: InboxScope, rows: readonly NoticeRow[]): Keyed[] {
    return rows
      .filter((row) =>
        Notice.shownTo({
          teamId: row.notice.teamId,
          addressee: nonEmpty(row.notice.addresseeId)
            ? UserId.of(row.notice.addresseeId)
            : null,
          person: scope.viewer,
          teamsSeen: scope.teamsSeen,
          isAdmin: scope.isAdmin,
        }),
      )
      .map(({ notice: row, cursorAt }) => {
        const unread = Notice.unread(row.resolvedAt);

        return keyedAt(
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
            unread,
            unreadCount: unread ? 1 : 0,
            resolved: row.resolvedAt !== null,
            section: inboxSectionOf({
              unread,
              resolved: row.resolvedAt !== null,
              running: false,
              following: false,
            }),
            resolvable: Notice.resolvableBy(
              noticeStandingOf(scope, row.teamId),
              row.resolvedAt,
            ),
            reopenable: Notice.reopenableBy(
              noticeStandingOf(scope, row.teamId),
              row.resolvedAt,
            ),
          },
          cursorAt,
        );
      });
  }

  private async chatItems(rows: readonly ChatRow[]): Promise<Keyed[]> {
    const currentRunOf = await currentRunsOf(
      this.progress,
      rows.map((row) => row.currentRunId),
    );

    return rows.map((row) => {
      const facts = chatInboxFactsOf(row);
      const standing = chatInboxStanding(facts);
      const current = currentRunOf(row.currentRunId);
      const progress = chatProgress(facts, current.reading);
      const entry: InboxChatSummary = {
        kind: 'chat',
        id: row.id,
        teamId: row.teamId,
        title: row.title,
        progress,
        waiting: progress === 'queued' ? current.waiting : null,
        openProposals: row.openProposals,
        askedAt: row.lastAt,
        unread: standing.unread,
        unreadCount: standing.unread ? 1 : 0,
        resolved: standing.resolved,
        section: inboxSectionOf({ ...standing, following: false }),
        reopenable: standing.resolved,
      };

      return keyedAt(entry, row.cursorAt ?? '');
    });
  }
}
