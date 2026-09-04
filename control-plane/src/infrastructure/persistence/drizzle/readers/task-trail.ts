import { RunSpecContract } from '@application/contracts/run-spec.contract';
import type { InboxNote } from '@application/ports/inbox-reader.port';
import type { RunReview } from '@application/ports/run-reader.port';
import { owedIn, reviewsIn } from '@domain/services/conversations';
import { ConversationId } from '@domain/value-objects/conversation-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import type { TaskNoteKind } from '@domain/value-objects/task-note.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { station } from '@infrastructure/persistence/drizzle/schemas/assembly-line.schema';
import { user } from '@infrastructure/persistence/drizzle/schemas/auth.schema';
import { run } from '@infrastructure/persistence/drizzle/schemas/run.schema';
import {
  task,
  taskNote,
} from '@infrastructure/persistence/drizzle/schemas/task.schema';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export const DEFAULT_STATION_COLOR = '#a3a8b0';

export const trailsFor = async (
  db: DrizzleDatabase,
  taskIds: readonly string[],
): Promise<Map<string, InboxNote[]>> => {
  const trail = new Map<string, InboxNote[]>();

  if (taskIds.length === 0) {
    return trail;
  }

  // A note keeps the station's name, not its identity.
  const spoke = alias(station, 'spoke');

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
      authorId: user.id,
      authorName: user.name,
      authorImage: user.image,
    })
    .from(taskNote)
    .innerJoin(task, eq(task.id, taskNote.taskId))
    .innerJoin(station, eq(station.id, task.stationId))
    .leftJoin(
      spoke,
      and(
        eq(spoke.assemblyLineId, station.assemblyLineId),
        eq(spoke.name, taskNote.station),
      ),
    )
    .leftJoin(user, eq(user.id, taskNote.authorId))
    .where(inArray(taskNote.taskId, [...taskIds]))
    .orderBy(asc(taskNote.taskId), asc(taskNote.position));

  for (const row of rows) {
    const told = trail.get(row.taskId) ?? [];

    told.push({
      position: row.position,
      station: row.station,
      // Renamed or removed since, it answers to nothing and takes the grey.
      stationColor: row.stationColor ?? DEFAULT_STATION_COLOR,
      stationPosition: row.stationPosition ?? 0,
      runId: row.runId,
      kind: row.kind,
      form: row.form,
      voice: row.voice,
      body: row.body,
      at: row.at,
      readAt: row.readAt,
      author: row.authorId
        ? {
            id: row.authorId,
            name: row.authorName ?? '',
            image: row.authorImage,
          }
        : null,
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
    .select({ lineId: station.assemblyLineId, held: count() })
    .from(station)
    .where(inArray(station.assemblyLineId, named))
    .groupBy(station.assemblyLineId);

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
    const spec = RunSpecContract.from(row.spec);

    if (spec) {
      given.set(row.id, spec.briefing);
    }
  }

  return given;
};
