import { Task } from '@domain/aggregates/task.aggregate';
import { TaskMovedOnError } from '@domain/exceptions/task-moved-on.error';
import type {
  SetupLists,
  StandingSetup,
  TaskPlacement,
  TaskRepository,
} from '@domain/repositories/task.repository';
import type { Concerns } from '@domain/value-objects/concerns.vo';
import { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { Mark } from '@domain/value-objects/mark.vo';
import { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';
import { Repository } from '@domain/value-objects/repository.vo';
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
import {
  assemblyLine,
  station,
} from '@infrastructure/persistence/drizzle/schemas/assembly-line.schema';
import { factory } from '@infrastructure/persistence/drizzle/schemas/factory.schema';
import {
  task,
  taskMark,
  taskNote,
} from '@infrastructure/persistence/drizzle/schemas/task.schema';
import { Injectable } from '@nestjs/common';
import { and, asc, eq, gt, inArray, notExists, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

type Row = typeof task.$inferSelect;
type NoteRow = typeof taskNote.$inferSelect;

const toNote = (row: NoteRow): TaskNote =>
  TaskNote.of({
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

const toTask = (row: Row, notes: NoteRow[], marks: MarkRow[] = []): Task =>
  Task.rehydrate({
    id: TaskId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    stationId: StationId.of(row.stationId),
    title: TaskTitle.of(row.title),
    description: row.description ? TaskDescription.of(row.description) : null,
    rank: TaskRank.of(row.rank),
    currentRunId: row.currentRunId ? RunId.of(row.currentRunId) : null,
    sessionId: row.sessionId ? HarnessSession.of(row.sessionId) : null,
    runnerId: row.runnerId ? RunnerId.of(row.runnerId) : null,
    notes: notes.map(toNote),
    createdAt: row.createdAt,
    raisedAt: row.raisedAtStationId
      ? StationId.of(row.raisedAtStationId)
      : null,
    raisedBy: row.raisedById ? UserId.of(row.raisedById) : null,
    repository: row.repository ? Repository.of(row.repository) : null,
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
      repository: added.repository?.value ?? null,
      pullRequest: added.pullRequest?.value ?? null,
      finishedAt: added.finishedAt,
    });

    await this.writeNotes(added);
    await this.writeMarks(added);
  }

  /**
   * Written against the version it was read at. Everything here is written,
   * not just what the writer touched, so the second of two writers answering
   * one reading would carry the first one's changes away.
   */
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
      })
      .where(and(eq(task.id, saved.id.value), eq(task.version, saved.version)))
      .returning({ id: task.id });

    if (written.length === 0) {
      throw new TaskMovedOnError(saved.id.value);
    }

    await this.writeNotes(saved);
    await this.writeMarks(saved);
  }

  /**
   * Added and never taken away here: a handle the world has used once may be
   * used again, and a task that stopped wearing one would simply go missing
   * the next time its host mentioned it. Taken from whoever wore it before,
   * because a handle names one task.
   */
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

    const [notes, marks] = await Promise.all([
      this.notesFor([found.id]),
      this.marksFor(found.id),
    ]);

    return toTask(found, notes.get(found.id) ?? [], marks);
  }

  async holding(
    workspaceId: WorkspaceId,
    concerns: Concerns,
  ): Promise<Task | null> {
    // A branch names the task outright. Anything else is a handle somebody
    // out there uses, and the same question whichever host used it: which
    // task here wears this. Nothing below knows which host asked.
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
      // A burst about one task is written one at a time.
      .for('update');

    if (!found) {
      return null;
    }

    const [notes, marks] = await Promise.all([
      this.notesFor([found.id]),
      this.marksFor(found.id),
    ]);

    return toTask(found, notes.get(found.id) ?? [], marks);
  }

  async remove(id: TaskId): Promise<void> {
    await this.context.db.delete(task).where(eq(task.id, id.value));
  }

  async standingAt(stationId: StationId): Promise<Task[]> {
    const found = await this.context.db
      .select()
      .from(task)
      .where(eq(task.stationId, stationId.value))
      .orderBy(task.rank);

    const notes = await this.notesFor(found.map((each) => each.id));

    return found.map((each) => toTask(each, notes.get(each.id) ?? []));
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

  /**
   * Still standing means what the domain means by it: no note closed the
   * conversation the list opened. Anything else here would be a second
   * opinion on when a list is done with.
   */
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
      .innerJoin(assemblyLine, eq(assemblyLine.id, station.assemblyLineId))
      .innerJoin(factory, eq(factory.id, assemblyLine.factoryId))
      .where(of ? and(open, of) : open);

    const notes = await this.notesFor(found.map((each) => each.task.id));

    return found.map((each) => ({
      teamId: TeamId.of(each.teamId),
      task: toTask(each.task, notes.get(each.task.id) ?? []),
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

  /** A trail is added to and marked, never cut. */
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
