import { Task } from '@domain/aggregates/task.aggregate';
import type {
  TaskPlacement,
  TaskRepository,
} from '@domain/repositories/task.repository';
import { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskDescription } from '@domain/value-objects/task-description.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TaskNote } from '@domain/value-objects/task-note.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import {
  task,
  taskNote,
} from '@infrastructure/persistence/drizzle/schemas/task.schema';
import { Injectable } from '@nestjs/common';
import { asc, eq, inArray } from 'drizzle-orm';

type Row = typeof task.$inferSelect;
type NoteRow = typeof taskNote.$inferSelect;

const toNote = (row: NoteRow): TaskNote =>
  TaskNote.of({
    station: StationName.of(row.station),
    body: TaskNoteBody.of(row.body),
    at: row.at,
    author: row.authorId ? UserId.of(row.authorId) : null,
    run: row.runId ? RunId.of(row.runId) : null,
    kind: row.kind ?? 'passed',
  });

const toTask = (row: Row, notes: NoteRow[]): Task =>
  Task.rehydrate({
    id: TaskId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    stationId: StationId.of(row.stationId),
    title: TaskTitle.of(row.title),
    description: row.description ? TaskDescription.of(row.description) : null,
    rank: TaskRank.of(row.rank),
    currentRunId: row.currentRunId ? RunId.of(row.currentRunId) : null,
    awaitingReview: row.awaitingReview,
    sessionId: row.sessionId ? HarnessSession.of(row.sessionId) : null,
    runnerId: row.runnerId ? RunnerId.of(row.runnerId) : null,
    notes: notes.map(toNote),
    createdAt: row.createdAt,
    raisedAt: row.raisedAtStationId
      ? StationId.of(row.raisedAtStationId)
      : null,
  });

@Injectable()
export class DrizzleTaskRepository implements TaskRepository {
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
      awaitingReview: added.awaitingReview,
      sessionId: added.sessionId?.value ?? null,
      runnerId: added.runnerId?.value ?? null,
      createdAt: added.createdAt,
      raisedAtStationId: added.raisedAt?.value ?? null,
    });

    await this.writeNotes(added);
  }

  async save(saved: Task): Promise<void> {
    await this.context.db
      .update(task)
      .set({
        stationId: saved.stationId.value,
        title: saved.title.value,
        description: saved.description?.value ?? null,
        rank: saved.rank.value,
        currentRunId: saved.currentRunId?.value ?? null,
        awaitingReview: saved.awaitingReview,
        sessionId: saved.sessionId?.value ?? null,
        runnerId: saved.runnerId?.value ?? null,
      })
      .where(eq(task.id, saved.id.value));

    await this.writeNotes(saved);
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

    const notes = await this.notesFor([found.id]);

    return toTask(found, notes.get(found.id) ?? []);
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

  private async writeNotes(saved: Task): Promise<void> {
    await this.context.db
      .delete(taskNote)
      .where(eq(taskNote.taskId, saved.id.value));

    if (saved.notes.length === 0) {
      return;
    }

    await this.context.db.insert(taskNote).values(
      saved.notes.map((note, position) => ({
        taskId: saved.id.value,
        position,
        station: note.station.value,
        body: note.body.value,
        at: note.at,
        authorId: note.author?.value ?? null,
        runId: note.run?.value ?? null,
        kind: note.kind,
      })),
    );
  }
}
