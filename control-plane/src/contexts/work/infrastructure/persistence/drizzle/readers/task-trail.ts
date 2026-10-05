import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { RunSpecContract } from '@work/application/contracts/run-spec.contract';
import type { AttachmentSummary } from '@work/application/ports/attachment-reader.port';
import type {
  InboxApproval,
  InboxConnection,
  InboxFailure,
  InboxNote,
} from '@work/application/ports/inbox-reader.port';
import type { RunReview } from '@work/application/ports/run-reader.port';
import type { TaskNoteKind } from '@work/domain/entities/task-note.entity';
import { owedIn, reviewsIn } from '@work/domain/services/conversations';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import {
  toApprovalSubject,
  toEditedCall,
} from '@work/infrastructure/persistence/drizzle/repositories/approval-subject.rows';
import { station } from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import {
  type ApprovalRow,
  type ConnectionAskRow,
  type FailureRow,
  task,
  taskAttachment,
  taskNote,
} from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export interface TaskAttachments {
  readonly own: readonly AttachmentSummary[];
  readonly said: ReadonlyMap<number, readonly AttachmentSummary[]>;
}

const NONE: TaskAttachments = { own: [], said: new Map() };

interface Gathered {
  own: AttachmentSummary[];
  said: Map<number, AttachmentSummary[]>;
}

export const attachmentsOf = (
  held: ReadonlyMap<string, TaskAttachments>,
  taskId: string,
): TaskAttachments => held.get(taskId) ?? NONE;

export const attachmentsFor = async (
  db: DrizzleDatabase,
  taskIds: readonly string[],
): Promise<Map<string, TaskAttachments>> => {
  const held = new Map<string, Gathered>();
  const named = [...new Set(taskIds)];

  if (named.length === 0) {
    return held;
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
    const files: Gathered = held.get(taskId) ?? { own: [], said: new Map() };

    if (notePosition === null) {
      files.own.push(file);
    } else {
      files.said.set(notePosition, [
        ...(files.said.get(notePosition) ?? []),
        file,
      ]);
    }

    held.set(taskId, files);
  }

  return held;
};

const asked = (parts: ApprovalRow | null): InboxApproval | null => {
  if (!parts) {
    return null;
  }

  const subject = toApprovalSubject(parts.subject);

  return {
    kind: subject.kind,
    name: subject.name,
    because: parts.because,
    inputs: subject.given,
    standing: parts.standing,
    edited: toEditedCall(parts)?.given ?? null,
    intent: parts.intent ?? null,
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
        source: parts.source,
        integration: parts.integration,
        personId: parts.personId,
        personName: named.get(parts.personId)?.name ?? '',
        met: parts.met,
      }
    : null;

export const failureIn = (notes: readonly InboxNote[]): InboxFailure | null =>
  notes.reduce<InboxFailure | null>(
    (about, note) => note.failure ?? about,
    null,
  );

export const trailsFor = async (
  db: DrizzleDatabase,
  people: PersonReaderPort,
  taskIds: readonly string[],
): Promise<Map<string, InboxNote[]>> => {
  const trail = new Map<string, InboxNote[]>();

  if (taskIds.length === 0) {
    return trail;
  }

  const spoke = alias(station, 'spoke');

  const attached = await attachmentsFor(db, taskIds);

  const rows = await db
    .select({
      taskId: taskNote.taskId,
      position: taskNote.position,
      station: taskNote.station,
      stationColor: spoke.color,
      stationPosition: spoke.position,
      runId: taskNote.runId,
      kind: taskNote.kind,
      form: taskNote.form,
      voice: taskNote.voice,
      readAt: taskNote.readAt,
      body: taskNote.body,
      at: taskNote.at,
      authorId: taskNote.authorId,
      approval: taskNote.approval,
      failure: taskNote.failure,
      connectionAsk: taskNote.connectionAsk,
    })
    .from(taskNote)
    .innerJoin(task, eq(task.id, taskNote.taskId))
    .innerJoin(station, eq(station.id, task.stationId))
    .leftJoin(
      spoke,
      and(eq(spoke.lineId, station.lineId), eq(spoke.name, taskNote.station)),
    )
    .where(inArray(taskNote.taskId, [...taskIds]))
    .orderBy(asc(taskNote.taskId), asc(taskNote.position));

  const authors = await people.findMany(
    rows.flatMap((row) => [
      ...(row.authorId ? [UserId.of(row.authorId)] : []),
      ...(row.connectionAsk ? [UserId.of(row.connectionAsk.personId)] : []),
    ]),
  );

  for (const row of rows) {
    const told = trail.get(row.taskId) ?? [];
    const author = row.authorId ? authors.get(row.authorId) : undefined;

    told.push({
      position: row.position,
      station: row.station,
      stationColor: row.stationColor ?? StationColor.plain().value,
      stationPosition: row.stationPosition ?? 0,
      runId: row.runId,
      kind: row.kind,
      form: row.form,
      voice: row.voice,
      body: row.body,
      attachments:
        attachmentsOf(attached, row.taskId).said.get(row.position) ?? [],
      at: row.at,
      readAt: row.readAt,
      author: row.authorId
        ? {
            id: row.authorId,
            name: author?.name ?? '',
            image: author?.image ?? null,
          }
        : null,
      approval: asked(row.approval),
      failure: failed(row.failure),
      connection: connecting(row.connectionAsk, authors),
    });

    trail.set(row.taskId, told);
  }

  return trail;
};

export const stationsPerLine = async (
  db: DrizzleDatabase,
  lineIds: readonly string[],
): Promise<Map<string, number>> => {
  const held = new Map<string, number>();
  const named = [...new Set(lineIds)];

  if (named.length === 0) {
    return held;
  }

  const rows = await db
    .select({ lineId: station.lineId, held: count() })
    .from(station)
    .where(inArray(station.lineId, named))
    .groupBy(station.lineId);

  for (const row of rows) {
    held.set(row.lineId, row.held);
  }

  return held;
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
    .select({ taskId: taskNote.taskId, kind: taskNote.kind })
    .from(taskNote)
    .where(inArray(taskNote.taskId, named))
    .orderBy(asc(taskNote.taskId), asc(taskNote.position));

  const trails = new Map<string, { kind: TaskNoteKind }[]>();

  for (const row of rows) {
    const told = trails.get(row.taskId) ?? [];
    told.push({ kind: row.kind });
    trails.set(row.taskId, told);
  }

  for (const [taskId, trail] of trails) {
    const owed = owedIn(trail);

    if (owed) {
      awaited.set(
        taskId,
        ConversationId.of({ taskId: TaskId.of(taskId), from: owed.from }).value,
      );
    }
  }

  return awaited;
};

type Asked = {
  taskId: string;
  position: number;
  kind: TaskNoteKind;
  runId: string | null;
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

  const trails = new Map<string, Asked[]>();

  for (const row of rows) {
    const told = trails.get(row.taskId) ?? [];
    told.push({
      taskId: row.taskId,
      position: row.position,
      kind: row.kind,
      runId: row.runId,
    });
    trails.set(row.taskId, told);
  }

  for (const [taskId, trail] of trails) {
    for (const [runId, asked] of reviewsIn(trail)) {
      review.set(runId, {
        state: asked.state,
        conversationId: ConversationId.of({
          taskId: TaskId.of(taskId),
          from: asked.from,
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
  const given = new Map<string, string>();
  const named = [...new Set(runIds)];

  if (named.length === 0) {
    return given;
  }

  const rows = await db
    .select({ id: run.id, spec: run.spec })
    .from(run)
    .where(inArray(run.id, named));

  for (const row of rows) {
    given.set(row.id, RunSpecContract.from(row.spec).briefing);
  }

  return given;
};
