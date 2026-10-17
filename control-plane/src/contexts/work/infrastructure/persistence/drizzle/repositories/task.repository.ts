import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  FOREIGN_KEY_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskNote } from '@work/domain/entities/task-note.entity';
import { MarkAlreadyClaimedError } from '@work/domain/exceptions/mark-already-claimed.error';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { openSetupList } from '@work/domain/services/setup-list';
import { Approval } from '@work/domain/value-objects/approval.vo';
import { ApprovalIntent } from '@work/domain/value-objects/approval-intent.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { Concerns } from '@work/domain/value-objects/concerns.vo';
import { ConnectionAsk } from '@work/domain/value-objects/connection-ask.vo';
import { DeferredMove } from '@work/domain/value-objects/deferred-move.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { PullRequestLink } from '@work/domain/value-objects/pull-request-link.vo';
import { Said } from '@work/domain/value-objects/said.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { claimAttachments } from '@work/infrastructure/persistence/drizzle/attachment-claims';
import {
  toApprovalSubject,
  toApprovalSubjectRow,
  toEditedCall,
} from '@work/infrastructure/persistence/drizzle/repositories/approval-subject.rows';
import {
  line,
  station,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import {
  type ApprovalRow,
  type ConnectionAskRow,
  type DeferredMoveRow,
  task,
  taskAttachment,
  taskMark,
  taskNote,
} from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { and, eq, gt, inArray, not, notExists, or, sql } from 'drizzle-orm';
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

const toApproval = (row: ApprovalRow): Approval =>
  Approval.rehydrate({
    subject: toApprovalSubject(row.subject),
    at: StationId.of(row.stationId),
    because: row.because,
    status: row.status,
    decided:
      row.decidedBy && row.decidedAt
        ? {
            by: UserId.of(row.decidedBy),
            at: new Date(row.decidedAt),
            reason: row.reason ?? '',
          }
        : null,
    spent: row.spent,
    edited: toEditedCall(row),
    intent: row.intent ? ApprovalIntent.rehydrate(row.intent) : null,
    askedOf: row.askedOf ? UserId.of(row.askedOf) : null,
  });

const toApprovalRow = (approval: Approval): ApprovalRow => ({
  subject: toApprovalSubjectRow(approval.subject),
  stationId: approval.at.value,
  because: approval.because,
  status: approval.status,
  decidedBy: approval.decided?.by.value ?? null,
  decidedAt: approval.decided?.at.toISOString() ?? null,
  reason: approval.decided?.reason ?? null,
  spent: approval.spent,
  edited: approval.edited?.inputs.values ?? null,
  intent: approval.intent?.value ?? null,
  askedOf: approval.askedOf?.value ?? null,
});

const toDeferredMove = (row: DeferredMoveRow): DeferredMove =>
  row.kind === 'moves'
    ? DeferredMove.moveTo(StationId.of(row.to))
    : DeferredMove.cleared();

const toDeferredMoveRow = (move: DeferredMove): DeferredMoveRow =>
  move.to ? { kind: 'moves', to: move.to.value } : { kind: 'cleared' };

const toConnectionAsk = (row: ConnectionAskRow): ConnectionAsk =>
  ConnectionAsk.of({
    teamId: TeamId.of(row.teamId),
    source: row.source,
    integration: row.integration,
    personId: UserId.of(row.personId),
    met: row.met,
  });

const toConnectionAskRow = (ask: ConnectionAsk): ConnectionAskRow => ({
  teamId: ask.teamId.value,
  source: ask.source,
  integration: ask.integration,
  personId: ask.personId.value,
  met: ask.met,
});

const toNote = (row: NoteRow, attachments: AttachmentRow[]): TaskNote =>
  TaskNote.of({
    position: NotePosition.of(row.position),
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
    approval: row.approval ? toApproval(row.approval) : null,
    failure: row.failure ? TaskFailure.rehydrate(row.failure) : null,
    deferredMove: row.deferredMove ? toDeferredMove(row.deferredMove) : null,
    connectionAsk: row.connectionAsk
      ? toConnectionAsk(row.connectionAsk)
      : null,
  });

const toTask = (
  row: Row,
  notes: NoteRow[],
  attachments: AttachmentRow[],
  marks: MarkRow[],
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
    openedFrom: TaskOrigin.of(row.openedFrom),
    assignee: row.assigneeId ? UserId.of(row.assigneeId) : null,
    finishedAt: row.finishedAt,
    revision: TaskRevision.of(row.revision),
    version: row.version,
    pullRequestLink: row.pullRequest
      ? row.reviewing
        ? PullRequestLink.reviewing(PullRequestUrl.of(row.pullRequest), {
            outside: row.reviewFromOutside,
          })
        : PullRequestLink.opened(PullRequestUrl.of(row.pullRequest))
      : null,
    marks: marks.map((each) => Mark.of(each.kind, each.value)),
  });

interface MarkRow {
  readonly taskId: string;
  readonly kind: string;
  readonly value: string;
}

@Injectable()
export class DrizzleTaskRepository implements TaskRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: Task): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.inserted(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  private async inserted(added: Task): Promise<void> {
    await this.atStation(added, () =>
      this.context.db.insert(task).values({
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
        openedFrom: added.openedFrom.value,
        assigneeId: added.assignee?.value ?? null,
        pullRequest: added.pullRequest?.value ?? null,
        reviewing: added.reviewing,
        reviewFromOutside: added.fromOutside,
        finishedAt: added.finishedAt,
        revision: added.revision.value,
      }),
    );

    await this.writeNotes(added);
    await this.writeAttachments(added);
    await this.writeMarks(added);
  }

  async save(saved: Task): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.stored(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async atStation<T>(
    written: Task,
    work: () => Promise<T>,
  ): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (violates(error, FOREIGN_KEY_VIOLATION, 'station_id_station_id_fk')) {
        throw new UnknownStationError(written.stationId.value);
      }

      throw error;
    }
  }

  private async stored(saved: Task): Promise<void> {
    const written = await this.atStation(saved, () =>
      this.context.db
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
          reviewing: saved.reviewing,
          reviewFromOutside: saved.fromOutside,
          finishedAt: saved.finishedAt,
          assigneeId: saved.assignee?.value ?? null,
          revision: saved.revision.value,
        })
        .where(
          and(eq(task.id, saved.id.value), eq(task.version, saved.version)),
        )
        .returning({ id: task.id }),
    );

    if (written.length === 0) {
      throw new TaskVersionConflictError(saved.id.value);
    }

    await this.writeNotes(saved);
    await this.writeAttachments(saved);
    await this.writeMarks(saved);
  }

  private async writeMarks(written: Task): Promise<void> {
    const marked = or(
      ...written.marks.map((mark) =>
        and(eq(taskMark.kind, mark.kind), eq(taskMark.value, mark.value)),
      ),
    );

    await this.context.db
      .delete(taskMark)
      .where(
        and(
          eq(taskMark.taskId, written.id.value),
          marked ? not(marked) : undefined,
        ),
      );

    if (written.marks.length === 0) {
      return;
    }

    const kept = await this.context.db
      .insert(taskMark)
      .values(
        written.marks.map((mark) => ({
          workspaceId: written.workspaceId.value,
          taskId: written.id.value,
          kind: mark.kind,
          value: mark.value,
        })),
      )
      .onConflictDoUpdate({
        target: [taskMark.workspaceId, taskMark.kind, taskMark.value],
        set: { taskId: sql`excluded.task_id` },
        setWhere: sql`${taskMark.taskId} = excluded.task_id`,
      })
      .returning({ kind: taskMark.kind, value: taskMark.value });

    const taken = written.marks.find(
      (mark) =>
        !kept.some(
          (each) => each.kind === mark.kind && each.value === mark.value,
        ),
    );

    if (taken) {
      throw new MarkAlreadyClaimedError(taken.toString());
    }
  }

  private async marksFor(taskIds: string[]): Promise<Map<string, MarkRow[]>> {
    if (taskIds.length === 0) {
      return new Map();
    }

    const rows = await this.context.db
      .select({
        taskId: taskMark.taskId,
        kind: taskMark.kind,
        value: taskMark.value,
      })
      .from(taskMark)
      .where(inArray(taskMark.taskId, taskIds));

    return rows.reduce((marked, row) => {
      marked.set(row.taskId, [...(marked.get(row.taskId) ?? []), row]);
      return marked;
    }, new Map<string, MarkRow[]>());
  }

  private async whole(rows: readonly Row[]): Promise<Task[]> {
    const ids = rows.map((each) => each.id);
    const notes = await this.notesFor(ids);
    const attachments = await this.attachmentsFor(ids);
    const marks = await this.marksFor(ids);

    return rows.map((each) =>
      toTask(
        each,
        notes.get(each.id) ?? [],
        attachments.get(each.id) ?? [],
        marks.get(each.id) ?? [],
      ),
    );
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

    const [whole] = await this.whole([found]);

    return whole ?? null;
  }

  async findByMarks(
    workspaceId: WorkspaceId,
    concerns: Concerns,
  ): Promise<Task | null> {
    const named = concerns.taskId
      ? eq(task.id, concerns.taskId.value)
      : undefined;

    const marked = concerns.marks.length
      ? inArray(
          task.id,
          this.context.db
            .select({ id: taskMark.taskId })
            .from(taskMark)
            .where(
              and(
                eq(taskMark.workspaceId, workspaceId.value),
                or(
                  ...concerns.marks.map((mark) =>
                    and(
                      eq(taskMark.kind, mark.kind),
                      eq(taskMark.value, mark.value),
                    ),
                  ),
                ),
              ),
            ),
        )
      : undefined;

    if (!named && !marked) {
      return null;
    }

    const [found] = await this.context.db
      .select()
      .from(task)
      .where(
        and(
          eq(task.workspaceId, workspaceId.value),
          named && marked ? or(named, marked) : (named ?? marked),
        ),
      )
      .limit(1)
      .for('update');

    if (!found) {
      return null;
    }

    const [whole] = await this.whole([found]);

    return whole ?? null;
  }

  async remove(removed: Task): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db.delete(task).where(eq(task.id, removed.id.value));
      await this.events.dispatch(removed.pullEvents());
    });
  }

  async allAtStation(stationId: StationId): Promise<Task[]> {
    const found = await this.context.db
      .select()
      .from(task)
      .where(eq(task.stationId, stationId.value))
      .orderBy(task.rank);

    return this.whole(found);
  }

  async settingUpFor(teamId: TeamId): Promise<Task | null> {
    const [found] = await this.openSetups(eq(line.teamId, teamId.value));

    return found ?? null;
  }

  async settingUpIn(workspaceId: WorkspaceId): Promise<readonly Task[]> {
    return this.openSetups(eq(task.workspaceId, workspaceId.value));
  }

  async settingUp(): Promise<readonly Task[]> {
    return this.openSetups();
  }

  async awaitingConnection(
    teamId: TeamId,
    personId: UserId,
    source: string,
  ): Promise<readonly Task[]> {
    const found = await this.context.db
      .select()
      .from(task)
      .where(
        inArray(
          task.id,
          this.context.db
            .select({ id: taskNote.taskId })
            .from(taskNote)
            .where(
              and(
                sql`${taskNote.connectionAsk} is not null`,
                sql`(${taskNote.connectionAsk}->>'personId') = ${personId.value}`,
                sql`(${taskNote.connectionAsk}->>'source') = ${source}`,
                sql`(${taskNote.connectionAsk}->>'teamId') = ${teamId.value}`,
                sql`(${taskNote.connectionAsk}->>'met')::boolean = false`,
              ),
            ),
        ),
      );

    return this.whole(found);
  }

  private async openSetups(of?: ReturnType<typeof eq>): Promise<Task[]> {
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
      .select({ task })
      .from(task)
      .innerJoin(
        taskNote,
        and(eq(taskNote.taskId, task.id), eq(taskNote.form, 'setup')),
      )
      .innerJoin(station, eq(station.id, task.stationId))
      .innerJoin(line, eq(line.id, station.lineId))
      .where(of ? and(open, of) : open);

    const unique = [
      ...new Map(found.map((each) => [each.task.id, each.task])).values(),
    ];

    return (await this.whole(unique)).filter((each) =>
      openSetupList(each.notes),
    );
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

    return rows.reduce((byTask, row) => {
      byTask.set(row.taskId, [...(byTask.get(row.taskId) ?? []), row]);
      return byTask;
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

    return rows.reduce((byTask, row) => {
      byTask.set(row.taskId, [...(byTask.get(row.taskId) ?? []), row]);
      return byTask;
    }, new Map<string, AttachmentRow[]>());
  }

  private async writeAttachments(written: Task): Promise<void> {
    await claimAttachments(
      this.context.db,
      written.workspaceId,
      { taskId: written.id.value },
      written.allAttachments,
    );

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
          approval: note.approval ? toApprovalRow(note.approval) : null,
          failure: note.failure
            ? {
                source: note.failure.source,
                code: note.failure.code,
                occurrences: note.failure.occurrences,
              }
            : null,
          deferredMove: note.deferredMove
            ? toDeferredMoveRow(note.deferredMove)
            : null,
          connectionAsk: note.connectionAsk
            ? toConnectionAskRow(note.connectionAsk)
            : null,
        })),
      )
      .onConflictDoUpdate({
        target: [taskNote.taskId, taskNote.position],
        set: {
          readAt: sql`excluded.read_at`,
          deliveredAt: sql`excluded.delivered_at`,
          answeredAt: sql`excluded.answered_at`,
          approval: sql`excluded.approval`,
          failure: sql`excluded.failure`,
          connectionAsk: sql`excluded.connection_ask`,
        },
      });
  }
}
