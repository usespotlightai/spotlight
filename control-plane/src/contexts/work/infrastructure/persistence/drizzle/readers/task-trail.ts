import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import { PLAIN_STATION_COLOR } from '@lines/application/contracts/line-view.contract';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { AttachmentSummary } from '@work/application/ports/attachment-reader.port';
import type {
  InboxApproval,
  InboxConnection,
  InboxFailure,
  InboxNote,
} from '@work/application/ports/inbox-reader.port';
import type { RunReview } from '@work/application/ports/run-reader.port';
import type { TaskNoteKind } from '@work/domain/entities/task-note.entity';
import {
  conversationsOf,
  notesIn,
  pendingIn,
  reviewsIn,
  TURNING_NOTE_KINDS,
} from '@work/domain/services/conversations';
import { deferralWaitingIn } from '@work/domain/services/deferred-moves';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';
import {
  toApprovalSubject,
  toEditedCall,
} from '@work/infrastructure/persistence/drizzle/repositories/approval-subject.rows';
import { dispatch } from '@work/infrastructure/persistence/drizzle/schemas/dispatch.schema';
import {
  type ApprovalRow,
  type ConnectionAskRow,
  type FailureRow,
  task,
  taskAttachment,
  taskNote,
} from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { workStation } from '@work/infrastructure/persistence/drizzle/schemas/work-station.schema';
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const deferredStation = alias(workStation, 'deferred_station');

export interface TaskAttachments {
  readonly own: readonly AttachmentSummary[];
  readonly byNote: ReadonlyMap<number, readonly AttachmentSummary[]>;
}

const NONE: TaskAttachments = { own: [], byNote: new Map() };

interface Gathered {
  own: AttachmentSummary[];
  byNote: Map<number, AttachmentSummary[]>;
}

export const attachmentsOf = (
  byTask: ReadonlyMap<string, TaskAttachments>,
  taskId: string,
): TaskAttachments => byTask.get(taskId) ?? NONE;

export const attachmentsFor = async (
  db: DrizzleDatabase,
  taskIds: readonly string[],
): Promise<Map<string, TaskAttachments>> => {
  const byTask = new Map<string, Gathered>();
  const named = [...new Set(taskIds)];

  if (named.length === 0) {
    return byTask;
  }

  const rows = await db
    .select({
      taskId: taskAttachment.taskId,
      notePosition: taskAttachment.notePosition,
      id: taskAttachment.id,
      name: taskAttachment.name,
      contentType: taskAttachment.contentType,
      size: taskAttachment.size,
    })
    .from(taskAttachment)
    .where(inArray(taskAttachment.taskId, named))
    .orderBy(asc(taskAttachment.notePosition), asc(taskAttachment.place));

  for (const { taskId, notePosition, ...file } of rows) {
    const files: Gathered = byTask.get(taskId) ?? {
      own: [],
      byNote: new Map(),
    };

    if (notePosition === null) {
      files.own.push(file);
    } else {
      files.byNote.set(notePosition, [
        ...(files.byNote.get(notePosition) ?? []),
        file,
      ]);
    }

    byTask.set(taskId, files);
  }

  return byTask;
};

const approvalOf = (
  parts: ApprovalRow | null,
  named: ReadonlyMap<string, { readonly name: string }>,
): InboxApproval | null => {
  if (!parts) {
    return null;
  }

  const subject = toApprovalSubject(parts.subject);

  return {
    kind: subject.kind,
    name: subject.name,
    because: parts.because,
    inputs: subject.writtenInputs,
    status: parts.status,
    edited: toEditedCall(parts)?.writtenInputs ?? null,
    intent: parts.intent ?? null,
    askedOf: parts.askedOf
      ? { id: parts.askedOf, name: named.get(parts.askedOf)?.name ?? '' }
      : null,
  };
};

const failed = (parts: FailureRow | null): InboxFailure | null =>
  parts
    ? {
        source: parts.source,
        code: parts.code,
        occurrences: parts.occurrences,
      }
    : null;

const connecting = (
  parts: ConnectionAskRow | null,
  named: ReadonlyMap<string, { readonly name: string }>,
): InboxConnection | null =>
  parts
    ? {
        integration: parts.integration,
        integrationName: parts.integrationName,
        personId: parts.personId,
        personName: named.get(parts.personId)?.name ?? '',
        met: parts.met,
      }
    : null;

export const failureIn = (
  notes: readonly Pick<InboxNote, 'failure'>[],
): InboxFailure | null =>
  notes.reduce<InboxFailure | null>(
    (about, note) => note.failure ?? about,
    null,
  );

const NOTE_COLUMNS = {
  taskId: taskNote.taskId,
  position: taskNote.position,
  station: taskNote.station,
  stationId: taskNote.stationId,
  stationColor: workStation.color,
  stationPosition: workStation.position,
  runId: taskNote.runId,
  kind: taskNote.kind,
  form: taskNote.form,
  voice: taskNote.voice,
  readAt: taskNote.readAt,
  body: taskNote.body,
  at: taskNote.at,
  authorId: taskNote.authorId,
  source: taskNote.source,
  deferredTo: deferredStation.name,
  coAuthorIds: taskNote.coAuthorIds,
  approval: taskNote.approval,
  failure: taskNote.failure,
  connectionAsk: taskNote.connectionAsk,
};

type NoteRow = Pick<
  typeof taskNote.$inferSelect,
  | 'taskId'
  | 'position'
  | 'station'
  | 'stationId'
  | 'runId'
  | 'kind'
  | 'form'
  | 'voice'
  | 'readAt'
  | 'body'
  | 'at'
  | 'authorId'
  | 'source'
  | 'coAuthorIds'
  | 'approval'
  | 'failure'
  | 'connectionAsk'
> & {
  readonly stationColor: string | null;
  readonly stationPosition: number | null;
  readonly deferredTo: string | null;
};

const waitingDeferralsFor = async (
  db: DrizzleDatabase,
  taskIds: readonly string[],
): Promise<Map<string, number>> => {
  const rows = await db
    .select({
      taskId: taskNote.taskId,
      position: taskNote.position,
      kind: taskNote.kind,
      approval: taskNote.approval,
      deferredMove: taskNote.deferredMove,
      currentRunId: task.currentRunId,
    })
    .from(taskNote)
    .innerJoin(task, eq(task.id, taskNote.taskId))
    .where(inArray(taskNote.taskId, [...taskIds]))
    .orderBy(asc(taskNote.taskId), asc(taskNote.position));
  const trails = new Map<string, (typeof rows)[number][]>();

  for (const row of rows) {
    trails.set(row.taskId, [...(trails.get(row.taskId) ?? []), row]);
  }

  return new Map(
    [...trails].flatMap(([taskId, notes]) => {
      const waiting = deferralWaitingIn(notes, notes[0]?.currentRunId != null);

      return waiting ? [[taskId, waiting.position] as const] : [];
    }),
  );
};

const inboxNotesOf = async (
  db: DrizzleDatabase,
  people: PersonReaderPort,
  rows: readonly NoteRow[],
): Promise<(InboxNote & { readonly taskId: string })[]> => {
  if (rows.length === 0) {
    return [];
  }

  const taskIds = [...new Set(rows.map((row) => row.taskId))];
  const [attached, authors, waiting] = await Promise.all([
    attachmentsFor(
      db,
      rows.map((row) => row.taskId),
    ),
    people.findMany(
      rows.flatMap((row) => [
        ...(row.authorId ? [UserId.of(row.authorId)] : []),
        ...row.coAuthorIds.map(UserId.of),
        ...(row.connectionAsk ? [UserId.of(row.connectionAsk.personId)] : []),
        ...(row.approval?.askedOf ? [UserId.of(row.approval.askedOf)] : []),
      ]),
    ),
    waitingDeferralsFor(db, taskIds),
  ]);

  return rows.map((row) => {
    const author = row.authorId ? authors.get(row.authorId) : undefined;

    return {
      taskId: row.taskId,
      position: row.position,
      station: row.station,
      stationId: row.stationId,
      stationColor: row.stationColor ?? PLAIN_STATION_COLOR,
      stationPosition: row.stationPosition ?? 0,
      runId: row.runId,
      kind: row.kind,
      form: row.form,
      voice: row.voice,
      body: row.body,
      attachments:
        attachmentsOf(attached, row.taskId).byNote.get(row.position) ?? [],
      at: row.at,
      readAt: row.readAt,
      author: row.authorId
        ? {
            id: row.authorId,
            name: author?.name ?? '',
            image: author?.image ?? null,
          }
        : null,
      coAuthors: row.coAuthorIds.map((id) => ({
        id,
        name: authors.get(id)?.name ?? '',
        image: authors.get(id)?.image ?? null,
      })),
      source: row.source,
      deferredTo:
        waiting.get(row.taskId) === row.position ? row.deferredTo : null,
      approval: approvalOf(row.approval, authors),
      failure: failed(row.failure),
      connection: connecting(row.connectionAsk, authors),
    };
  });
};

const byTask = (
  notes: readonly (InboxNote & { readonly taskId: string })[],
): Map<string, InboxNote[]> => {
  const trail = new Map<string, InboxNote[]>();

  for (const { taskId, ...note } of notes) {
    trail.set(taskId, [...(trail.get(taskId) ?? []), note]);
  }

  return trail;
};

export const trailsFor = async (
  db: DrizzleDatabase,
  people: PersonReaderPort,
  taskIds: readonly string[],
): Promise<Map<string, InboxNote[]>> => {
  if (taskIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select(NOTE_COLUMNS)
    .from(taskNote)
    .leftJoin(workStation, eq(workStation.stationId, taskNote.stationId))
    .leftJoin(
      deferredStation,
      eq(deferredStation.stationId, sql`${taskNote.deferredMove} ->> 'to'`),
    )
    .where(inArray(taskNote.taskId, [...taskIds]))
    .orderBy(asc(taskNote.taskId), asc(taskNote.position));

  return byTask(await inboxNotesOf(db, people, rows));
};

export const newestNotesFor = async (
  db: DrizzleDatabase,
  people: PersonReaderPort,
  taskIds: readonly string[],
): Promise<Map<string, InboxNote>> => {
  const named = [...new Set(taskIds)];

  if (named.length === 0) {
    return new Map();
  }

  const rows = await db
    .selectDistinctOn([taskNote.taskId], NOTE_COLUMNS)
    .from(taskNote)
    .leftJoin(workStation, eq(workStation.stationId, taskNote.stationId))
    .leftJoin(
      deferredStation,
      eq(deferredStation.stationId, sql`${taskNote.deferredMove} ->> 'to'`),
    )
    .where(inArray(taskNote.taskId, named))
    .orderBy(taskNote.taskId, desc(taskNote.position));

  return new Map(
    (await inboxNotesOf(db, people, rows)).map(
      ({ taskId, ...note }) => [taskId, note] as const,
    ),
  );
};

export interface NoteAt {
  readonly taskId: string;
  readonly position: number;
}

export const noteKey = (at: NoteAt): string => `${at.taskId}:${at.position}`;

export const notesAt = async (
  db: DrizzleDatabase,
  people: PersonReaderPort,
  at: readonly NoteAt[],
): Promise<Map<string, InboxNote>> => {
  if (at.length === 0) {
    return new Map();
  }

  const rows = await db
    .select(NOTE_COLUMNS)
    .from(taskNote)
    .leftJoin(workStation, eq(workStation.stationId, taskNote.stationId))
    .leftJoin(
      deferredStation,
      eq(deferredStation.stationId, sql`${taskNote.deferredMove} ->> 'to'`),
    )
    .where(
      or(
        ...at.map((each) =>
          and(
            eq(taskNote.taskId, each.taskId),
            eq(taskNote.position, each.position),
          ),
        ),
      ),
    );

  return new Map(
    (await inboxNotesOf(db, people, rows)).map(
      ({ taskId, ...note }) =>
        [noteKey({ taskId, position: note.position }), note] as const,
    ),
  );
};

export type ConversationMark = Pick<
  InboxNote,
  | 'position'
  | 'kind'
  | 'readAt'
  | 'at'
  | 'station'
  | 'stationColor'
  | 'stationPosition'
  | 'runId'
  | 'failure'
>;

export const marksFor = async (
  db: DrizzleDatabase,
  taskIds: readonly string[],
): Promise<Map<string, ConversationMark[]>> => {
  const named = [...new Set(taskIds)];
  const marks = new Map<string, ConversationMark[]>();

  if (named.length === 0) {
    return marks;
  }

  const rows = await db
    .select({
      taskId: taskNote.taskId,
      position: taskNote.position,
      kind: taskNote.kind,
      readAt: taskNote.readAt,
      at: taskNote.at,
      station: taskNote.station,
      stationColor: workStation.color,
      stationPosition: workStation.position,
      runId: taskNote.runId,
      failure: taskNote.failure,
    })
    .from(taskNote)
    .leftJoin(workStation, eq(workStation.stationId, taskNote.stationId))
    .where(
      and(
        inArray(taskNote.taskId, named),
        or(
          inArray(taskNote.kind, [...TURNING_NOTE_KINDS]),
          isNotNull(taskNote.failure),
        ),
      ),
    )
    .orderBy(asc(taskNote.taskId), asc(taskNote.position));

  for (const { taskId, ...row } of rows) {
    marks.set(taskId, [
      ...(marks.get(taskId) ?? []),
      {
        ...row,
        stationColor: row.stationColor ?? PLAIN_STATION_COLOR,
        stationPosition: row.stationPosition ?? 0,
        failure: failed(row.failure),
      },
    ]);
  }

  return marks;
};

export interface MarkedConversation<T> {
  readonly from: T;
  readonly to: T | null;
  readonly notes: readonly T[];
}

export const conversationsAmong = <T extends { kind: TaskNoteKind }>(
  notes: readonly T[],
): MarkedConversation<T>[] =>
  conversationsOf(notes.map((each) => each.kind)).flatMap((conversation) => {
    const from = conversation.from.noteIn(notes);

    return from
      ? [
          {
            from,
            to:
              conversation.to === null
                ? null
                : (conversation.to.noteIn(notes) ?? null),
            notes: notesIn(conversation, notes),
          },
        ]
      : [];
  });

export const stationsPerLine = async (
  db: DrizzleDatabase,
  lineIds: readonly string[],
): Promise<Map<string, number>> => {
  const counts = new Map<string, number>();
  const named = [...new Set(lineIds)];

  if (named.length === 0) {
    return counts;
  }

  const rows = await db
    .select({ lineId: workStation.lineId, stations: count() })
    .from(workStation)
    .where(inArray(workStation.lineId, named))
    .groupBy(workStation.lineId);

  for (const row of rows) {
    counts.set(row.lineId, row.stations);
  }

  return counts;
};

export const awaitedReviewsFor = async (
  db: DrizzleDatabase,
  taskIds: readonly string[],
): Promise<Map<string, string>> => {
  const named = [...new Set(taskIds)];
  const awaited = new Map<string, string>();

  if (named.length === 0) {
    return awaited;
  }

  const rows = await db
    .select({
      taskId: taskNote.taskId,
      position: taskNote.position,
      kind: taskNote.kind,
    })
    .from(taskNote)
    .where(
      and(
        inArray(taskNote.taskId, named),
        inArray(taskNote.kind, [...TURNING_NOTE_KINDS]),
      ),
    )
    .orderBy(asc(taskNote.taskId), asc(taskNote.position));

  const trails = new Map<string, { kind: TaskNoteKind; position: number }[]>();

  for (const { taskId, ...note } of rows) {
    trails.set(taskId, [...(trails.get(taskId) ?? []), note]);
  }

  for (const [taskId, trail] of trails) {
    const pending = pendingIn(trail);
    const from = pending?.from.noteIn(trail);

    if (from) {
      awaited.set(
        taskId,
        ConversationId.of({ taskId: TaskId.of(taskId), from: from.position })
          .value,
      );
    }
  }

  return awaited;
};

type TrailNote = {
  taskId: string;
  position: number;
  kind: TaskNoteKind;
  runId: RunId | null;
};

export const reviewsBy = async (
  db: DrizzleDatabase,
  taskIds: readonly string[],
): Promise<Map<string, RunReview>> => {
  const named = [...new Set(taskIds)];
  const review = new Map<string, RunReview>();

  if (named.length === 0) {
    return review;
  }

  const rows = await db
    .select({
      taskId: taskNote.taskId,
      position: taskNote.position,
      kind: taskNote.kind,
      runId: taskNote.runId,
    })
    .from(taskNote)
    .where(inArray(taskNote.taskId, named))
    .orderBy(asc(taskNote.taskId), asc(taskNote.position));

  const trails = new Map<string, TrailNote[]>();

  for (const row of rows) {
    const notes = trails.get(row.taskId) ?? [];
    notes.push({
      taskId: row.taskId,
      position: row.position,
      kind: row.kind,
      runId: row.runId === null ? null : RunId.of(row.runId),
    });
    trails.set(row.taskId, notes);
  }

  for (const [taskId, trail] of trails) {
    for (const reviewed of reviewsIn(trail)) {
      review.set(reviewed.runId.value, {
        state: reviewed.state,
        conversationId: ConversationId.of({
          taskId: TaskId.of(taskId),
          from: reviewed.from.value,
        }).value,
      });
    }
  }

  return review;
};

export const briefingsFor = async (
  db: DrizzleDatabase,
  runIds: readonly string[],
): Promise<Map<string, string>> => {
  const briefings = new Map<string, string>();
  const named = [...new Set(runIds)];

  if (named.length === 0) {
    return briefings;
  }

  const rows = await db
    .select({ id: dispatch.id, briefing: dispatch.briefing })
    .from(dispatch)
    .where(inArray(dispatch.id, named));

  for (const row of rows) {
    if (row.briefing !== null) {
      briefings.set(row.id, row.briefing);
    }
  }

  return briefings;
};
