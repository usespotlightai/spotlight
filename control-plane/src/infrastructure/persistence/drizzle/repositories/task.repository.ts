import { Task } from '@domain/aggregates/task.aggregate';
import { TaskMovedOnError } from '@domain/exceptions/task-moved-on.error';
import type {
  SetupLists,
  StandingSetup,
  TaskPlacement,
  TaskRepository,
} from '@domain/repositories/task.repository';
import { Attachment } from '@domain/value-objects/attachment.vo';
import type { Concerns } from '@domain/value-objects/concerns.vo';
import { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { Mark } from '@domain/value-objects/mark.vo';
import { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { Said } from '@domain/value-objects/said.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskDescription } from '@domain/value-objects/task-description.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TaskNote } from '@domain/value-objects/task-note.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { Voice } from '@domain/value-objects/voice.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { factory } from '@infrastructure/persistence/drizzle/schemas/factory.schema';
import {
  line,
  station,
} from '@infrastructure/persistence/drizzle/schemas/line.schema';
import {
  task,
  taskAttachment,
  taskMark,
  taskNote,
} from '@infrastructure/persistence/drizzle/schemas/task.schema';
import { Injectable } from '@nestjs/common';
import { and, asc, eq, gt, inArray, notExists, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

type Row = typeof task.$inferSelect;
type NoteRow = typeof taskNote.$inferSelect;
type AttachmentRow = typeof taskAttachment.$inferSelect;

const toAttachments = (
  rows: readonly AttachmentRow[],
  at: number | null,
): Attachment[] =>
  rows
    .filter((row) => row.notePosition === at)
    .map((row) => Attachment.rehydrate(row));

const toNote = (row: NoteRow, attachments: AttachmentRow[]): TaskNote =>
  TaskNote.of({
    attachments: toAttachments(attachments, row.position),
    station: StationName.of(row.station),
    body: TaskNoteBody.of(row.body),
    at: row.at,
    voice: Voice.of({ by: row.voice, author: row.authorId, run: row.runId }),
    said: row.said ? Said.of(row.said) : null,
    answeredAt: row.answeredAt,
    kind: row.kind,
    readAt: row.readAt,
    deliveredAt: row.deliveredAt,
    form: row.form,
  });

const toTask = (
  row: Row,
  notes: NoteRow[],
  attachments: AttachmentRow[],
  marks: MarkRow[] = [],
): Task =>
  Task.rehydrate({
    attachments: toAttachments(attachments, null),
    id: TaskId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    stationId: StationId.of(row.stationId),
    title: TaskTitle.of(row.title),
    description: row.description ? TaskDescription.of(row.description) : null,
    rank: TaskRank.of(row.rank),
    currentRunId: row.currentRunId ? RunId.of(row.currentRunId) : null,
    sessionId: row.sessionId ? HarnessSession.of(row.sessionId) : null,
    runnerId: row.runnerId ? RunnerId.of(row.runnerId) : null,
    notes: notes.map((note) => toNote(note, attachments)),
    createdAt: row.createdAt,
    raisedAt: row.raisedAtStationId
      ? StationId.of(row.raisedAtStationId)
      : null,
    raisedBy: row.raisedById ? UserId.of(row.raisedById) : null,
    assignee: row.assigneeId ? UserId.of(row.assigneeId) : null,
    finishedAt: row.finishedAt,
    version: row.version,
    pullRequest: row.pullRequest ? PullRequestUrl.of(row.pullRequest) : null,
    marks: marks.map((each) => Mark.of(each.kind, each.value)),
  });

interface MarkRow {
  readonly kind: string;
  readonly value: string;
}

@Injectable()
export class DrizzleTaskRepository implements TaskRepository, SetupLists {
  constructor(private readonly context: DrizzleContext) {}

  async add(added: Task): Promise<void> {
    await this.context.db.insert(task).values({
      id: added.id.value,
      workspaceId: added.workspaceId.value,
      stationId: added.stationId.value,
      title: added.title.value,
      description: added.description?.value ?? null,
      rank: added.rank.value,
      currentRunId: added.currentRunId?.value ?? null,
      sessionId: added.sessionId?.value ?? null,
      runnerId: added.runnerId?.value ?? null,
      createdAt: added.createdAt,
      raisedAtStationId: added.raisedAt?.value ?? null,
      raisedById: added.raisedBy?.value ?? null,
      assigneeId: added.assignee?.value ?? null,
      pullRequest: added.pullRequest?.value ?? null,
      finishedAt: added.finishedAt,
    });

    await this.writeNotes(added);
    await this.writeAttachments(added);
    await this.writeMarks(added);
  }

  async save(saved: Task): Promise<void> {
    const written = await this.context.db
      .update(task)
      .set({
        version: saved.version + 1,
        stationId: saved.stationId.value,
        title: saved.title.value,
        description: saved.description?.value ?? null,
        rank: saved.rank.value,
        currentRunId: saved.currentRunId?.value ?? null,
        sessionId: saved.sessionId?.value ?? null,
        runnerId: saved.runnerId?.value ?? null,
        pullRequest: saved.pullRequest?.value ?? null,
        finishedAt: saved.finishedAt,
        assigneeId: saved.assignee?.value ?? null,
      })
      .where(and(eq(task.id, saved.id.value), eq(task.version, saved.version)))
      .returning({ id: task.id });

    if (written.length === 0) {
      throw new TaskMovedOnError(saved.id.value);
    }

    await this.writeNotes(saved);
    await this.writeAttachments(saved);
    await this.writeMarks(saved);
  }

  // Marks are only added or reassigned, never removed: a used handle may recur.
  private async writeMarks(written: Task): Promise<void> {
    for (const mark of written.marks) {
      await this.context.db
        .insert(taskMark)
        .values({
          taskId: written.id.value,
          kind: mark.kind,
          value: mark.value,
        })
        .onConflictDoUpdate({
          target: [taskMark.kind, taskMark.value],
          set: { taskId: written.id.value },
        });
    }
  }

  private async marksFor(taskId: string): Promise<MarkRow[]> {
    return this.context.db
      .select({ kind: taskMark.kind, value: taskMark.value })
      .from(taskMark)
      .where(eq(taskMark.taskId, taskId));
  }

  async placementsAt(stationId: StationId): Promise<TaskPlacement[]> {
    const rows = await this.context.db
      .select({ id: task.id, rank: task.rank })
      .from(task)
      .where(eq(task.stationId, stationId.value))
      .orderBy(asc(task.rank));

    return rows.map((row) => ({
      id: TaskId.of(row.id),
      rank: TaskRank.of(row.rank),
    }));
  }

  async find(id: TaskId): Promise<Task | null> {
    const [found] = await this.context.db
      .select()
      .from(task)
      .where(eq(task.id, id.value))
      .limit(1);

    if (!found) {
      return null;
    }

    const [notes, attachments, marks] = await Promise.all([
      this.notesFor([found.id]),
      this.attachmentsFor([found.id]),
      this.marksFor(found.id),
    ]);

    return toTask(
      found,
      notes.get(found.id) ?? [],
      attachments.get(found.id) ?? [],
      marks,
    );
  }

  async holding(
    workspaceId: WorkspaceId,
    concerns: Concerns,
  ): Promise<Task | null> {
    const named = concerns.taskId
      ? eq(task.id, concerns.taskId.value)
      : undefined;

    const worn = concerns.marks.length
      ? inArray(
          task.id,
          this.context.db
            .select({ id: taskMark.taskId })
            .from(taskMark)
            .where(
              or(
                ...concerns.marks.map((mark) =>
                  and(
                    eq(taskMark.kind, mark.kind),
                    eq(taskMark.value, mark.value),
                  ),
                ),
              ),
            ),
        )
      : undefined;

    if (!named && !worn) {
      return null;
    }

    const [found] = await this.context.db
      .select()
      .from(task)
      .where(
        and(
          eq(task.workspaceId, workspaceId.value),
          named && worn ? or(named, worn) : (named ?? worn),
        ),
      )
      .limit(1)
      .for('update');

    if (!found) {
      return null;
    }

    const [notes, attachments, marks] = await Promise.all([
      this.notesFor([found.id]),
      this.attachmentsFor([found.id]),
      this.marksFor(found.id),
    ]);

    return toTask(
      found,
      notes.get(found.id) ?? [],
      attachments.get(found.id) ?? [],
      marks,
    );
  }

  async remove(id: TaskId): Promise<void> {
    await this.context.db.delete(task).where(eq(task.id, id.value));
  }

  async countsAt(
    stationIds: readonly StationId[],
  ): Promise<ReadonlyMap<string, number>> {
    if (stationIds.length === 0) {
      return new Map();
    }

    const rows = await this.context.db
      .select({
        stationId: task.stationId,
        standing: sql<number>`count(*)::int`,
      })
      .from(task)
      .where(
        inArray(
          task.stationId,
          stationIds.map((each) => each.value),
        ),
      )
      .groupBy(task.stationId);

    return new Map(rows.map((row) => [row.stationId, Number(row.standing)]));
  }

  async standingAt(stationId: StationId): Promise<Task[]> {
    const found = await this.context.db
      .select()
      .from(task)
      .where(eq(task.stationId, stationId.value))
      .orderBy(task.rank);

    const ids = found.map((each) => each.id);
    const [notes, attachments] = await Promise.all([
      this.notesFor(ids),
      this.attachmentsFor(ids),
    ]);

    return found.map((each) =>
      toTask(each, notes.get(each.id) ?? [], attachments.get(each.id) ?? []),
    );
  }

  async settingUpFor(teamId: TeamId): Promise<StandingSetup | null> {
    const [found] = await this.standingSetups(eq(factory.teamId, teamId.value));

    return found ?? null;
  }

  async settingUpIn(
    workspaceId: WorkspaceId,
  ): Promise<readonly StandingSetup[]> {
    return this.standingSetups(eq(task.workspaceId, workspaceId.value));
  }

  async settingUp(): Promise<readonly StandingSetup[]> {
    return this.standingSetups();
  }

  private async standingSetups(
    of?: ReturnType<typeof eq>,
  ): Promise<StandingSetup[]> {
    const closing = alias(taskNote, 'closing');

    const open = notExists(
      this.context.db
        .select({ closed: sql`1` })
        .from(closing)
        .where(
          and(
            eq(closing.taskId, task.id),
            eq(closing.kind, 'passed'),
            gt(closing.position, taskNote.position),
          ),
        ),
    );

    const found = await this.context.db
      .select({ task, teamId: factory.teamId })
      .from(task)
      .innerJoin(
        taskNote,
        and(eq(taskNote.taskId, task.id), eq(taskNote.form, 'setup')),
      )
      .innerJoin(station, eq(station.id, task.stationId))
      .innerJoin(line, eq(line.id, station.lineId))
      .innerJoin(factory, eq(factory.id, line.factoryId))
      .where(of ? and(open, of) : open);

    const ids = found.map((each) => each.task.id);
    const [notes, attachments] = await Promise.all([
      this.notesFor(ids),
      this.attachmentsFor(ids),
    ]);

    return found.map((each) => ({
      teamId: TeamId.of(each.teamId),
      task: toTask(
        each.task,
        notes.get(each.task.id) ?? [],
        attachments.get(each.task.id) ?? [],
      ),
    }));
  }

  private async notesFor(taskIds: string[]): Promise<Map<string, NoteRow[]>> {
    if (taskIds.length === 0) {
      return new Map();
    }

    const rows = await this.context.db
      .select()
      .from(taskNote)
      .where(inArray(taskNote.taskId, taskIds))
      .orderBy(taskNote.position);

    return rows.reduce((standing, row) => {
      standing.set(row.taskId, [...(standing.get(row.taskId) ?? []), row]);
      return standing;
    }, new Map<string, NoteRow[]>());
  }

  private async attachmentsFor(
    taskIds: string[],
  ): Promise<Map<string, AttachmentRow[]>> {
    if (taskIds.length === 0) {
      return new Map();
    }

    const rows = await this.context.db
      .select()
      .from(taskAttachment)
      .where(inArray(taskAttachment.taskId, taskIds))
      .orderBy(taskAttachment.notePosition, taskAttachment.place);

    return rows.reduce((held, row) => {
      held.set(row.taskId, [...(held.get(row.taskId) ?? []), row]);
      return held;
    }, new Map<string, AttachmentRow[]>());
  }

  private async writeAttachments(written: Task): Promise<void> {
    const rows = [
      ...written.attachments.map((each, place) => ({
        each,
        notePosition: null,
        place,
      })),
      ...written.notes.flatMap((note, notePosition) =>
        note.attachments.map((each, place) => ({ each, notePosition, place })),
      ),
    ];

    if (rows.length === 0) {
      return;
    }

    await this.context.db
      .insert(taskAttachment)
      .values(
        rows.map(({ each, notePosition, place }) => ({
          id: each.id.value,
          taskId: written.id.value,
          notePosition,
          place,
          name: each.name,
          contentType: each.contentType,
          size: each.size,
        })),
      )
      .onConflictDoNothing({ target: taskAttachment.id });
  }

  private async writeNotes(saved: Task): Promise<void> {
    if (saved.notes.length === 0) {
      return;
    }

    await this.context.db
      .insert(taskNote)
      .values(
        saved.notes.map((note, position) => ({
          taskId: saved.id.value,
          position,
          station: note.station.value,
          body: note.body.value,
          at: note.at,
          said: note.said?.parts ?? null,
          answeredAt: note.answeredAt,
          voice: note.voice.by,
          authorId: note.voice.author?.value ?? null,
          runId: note.voice.run?.value ?? null,
          kind: note.kind,
          readAt: note.readAt,
          deliveredAt: note.deliveredAt,
          form: note.form,
        })),
      )
      .onConflictDoUpdate({
        target: [taskNote.taskId, taskNote.position],
        set: {
          readAt: sql`excluded.read_at`,
          deliveredAt: sql`excluded.delivered_at`,
          answeredAt: sql`excluded.answered_at`,
        },
      });
  }
}
