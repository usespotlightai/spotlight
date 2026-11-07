import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  FOREIGN_KEY_VIOLATION,
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { StationNotKnownYetError } from '@work/application/errors/station-not-known-yet.error';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskNote } from '@work/domain/entities/task-note.entity';
import { ProposalAlreadyOpenedError } from '@work/domain/exceptions/proposal-already-opened.error';
import { TaskBranchTakenError } from '@work/domain/exceptions/task-branch-taken.error';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Anchor } from '@work/domain/value-objects/anchor.vo';
import { Approval } from '@work/domain/value-objects/approval.vo';
import { ApprovalIntent } from '@work/domain/value-objects/approval-intent.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { AwaitedTurn } from '@work/domain/value-objects/awaited-turn.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ConnectionAsk } from '@work/domain/value-objects/connection-ask.vo';
import type { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import { DeferredMove } from '@work/domain/value-objects/deferred-move.vo';
import { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { HeldMark } from '@work/domain/value-objects/held-mark.vo';
import { IntegrationName } from '@work/domain/value-objects/integration-name.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import { PullRequestLink } from '@work/domain/value-objects/pull-request-link.vo';
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
  type ApprovalRow,
  type ConnectionAskRow,
  type DeferredMoveRow,
  task,
  taskAttachment,
  taskMark,
  taskNote,
} from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { workStation } from '@work/infrastructure/persistence/drizzle/schemas/work-station.schema';
import {
  and,
  eq,
  gt,
  inArray,
  isNotNull,
  lt,
  not,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';

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
  DeferredMove.moveTo(StationId.of(row.to));

const toDeferredMoveRow = (move: DeferredMove): DeferredMoveRow => ({
  to: move.to.value,
});

const toConnectionAsk = (row: ConnectionAskRow): ConnectionAsk =>
  ConnectionAsk.of({
    teamId: TeamId.of(row.teamId),
    integration: IntegrationName.of(row.integration),
    providedBy: row.integrationName,
    personId: UserId.of(row.personId),
    met: row.met,
  });

const toConnectionAskRow = (ask: ConnectionAsk): ConnectionAskRow => ({
  teamId: ask.teamId.value,
  integration: ask.integration.value,
  integrationName: ask.providedBy,
  personId: ask.personId.value,
  met: ask.met,
});

const toNote = (row: NoteRow, attachments: AttachmentRow[]): TaskNote =>
  TaskNote.of({
    position: NotePosition.of(row.position),
    attachments: toAttachments(attachments, row.position),
    station: StationName.of(row.station),
    stationId: StationId.of(row.stationId),
    body: TaskNoteBody.of(row.body),
    at: row.at,
    voice: Voice.of({
      kind: row.voice,
      author: row.authorId,
      coAuthors: row.coAuthorIds,
      run: row.runId,
    }),
    anchor: row.anchor ? Anchor.of(row.anchor) : null,
    answeredAt: row.answeredAt,
    kind: row.kind,
    readAt: row.readAt,
    acknowledgedAt: row.acknowledgedAt,
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
    branch: Branch.of(row.branch),
    description: row.description ? TaskDescription.of(row.description) : null,
    rank: TaskRank.of(row.rank),
    currentRunId: row.currentRunId ? RunId.of(row.currentRunId) : null,
    sessionId: row.sessionId ? HarnessSession.of(row.sessionId) : null,
    runnerId: row.runnerId ? RunnerId.of(row.runnerId) : null,
    notes: notes.map((note) => toNote(note, attachments)),
    createdAt: row.createdAt,
    originStationId: row.originStationId
      ? StationId.of(row.originStationId)
      : null,
    createdBy: row.createdById ? UserId.of(row.createdById) : null,
    openedFrom: TaskOrigin.decode(row.openedFrom),
    proposedIn:
      row.proposedInChatId !== null && row.proposedInPosition !== null
        ? ProposalOrigin.of({
            chatId: ChatId.of(row.proposedInChatId),
            position: MessagePosition.of(row.proposedInPosition),
          })
        : null,
    assignee: row.assigneeId ? UserId.of(row.assigneeId) : null,
    finishedAt: row.finishedAt,
    draftGeneration: DraftGeneration.of(row.draftGeneration),
    awaitedTurn:
      row.awaitedTurnAttempt !== null && row.currentRunId
        ? AwaitedTurn.of(RunId.of(row.currentRunId), row.awaitedTurnAttempt)
        : null,
    answeredTurnAt: row.answeredTurnAt,
    revision: TaskRevision.of(row.revision),
    version: row.version,
    pullRequestLink: row.pullRequest
      ? row.reviewing
        ? PullRequestLink.reviewing(PullRequestUrl.of(row.pullRequest), {
            outside: row.reviewFromOutside,
          })
        : PullRequestLink.opened(PullRequestUrl.of(row.pullRequest))
      : null,
    heldMarks: marks.map((each) =>
      HeldMark.of(Mark.of(each.kind, each.value), each.heldSince),
    ),
  });

interface MarkRow {
  readonly taskId: string;
  readonly kind: string;
  readonly value: string;
  readonly heldSince: Date;
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
    await this.translated(added, () =>
      this.context.db.insert(task).values({
        id: added.id.value,
        workspaceId: added.workspaceId.value,
        stationId: added.stationId.value,
        title: added.title.value,
        branch: added.branch.value,
        description: added.description?.value ?? null,
        rank: added.rank.value,
        currentRunId: added.currentRunId?.value ?? null,
        sessionId: added.sessionId?.value ?? null,
        runnerId: added.runnerId?.value ?? null,
        createdAt: added.createdAt,
        originStationId: added.originStationId?.value ?? null,
        createdById: added.createdBy?.value ?? null,
        openedFrom: added.openedFrom.encoded,
        proposedInChatId: added.proposedIn?.chatId.value ?? null,
        proposedInPosition: added.proposedIn?.position.value ?? null,
        assigneeId: added.assignee?.value ?? null,
        pullRequest: added.pullRequest?.value ?? null,
        reviewing: added.reviewing,
        reviewFromOutside: added.fromOutside,
        finishedAt: added.finishedAt,
        workspaceReleasedAt: added.workspaceRelease.releasedAt,
        revision: added.revision.value,
        isSetup: added.isSetup,
        setupOpen: added.setupOpen,
        unreadAsk: added.hasUnreadAsk,
        draftGeneration: added.draftGeneration.value,
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

  private async translated<T>(
    written: Task,
    work: () => Promise<T>,
  ): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (violates(error, FOREIGN_KEY_VIOLATION, 'task_station_fk')) {
        throw new StationNotKnownYetError(written.stationId.value);
      }

      if (violates(error, UNIQUE_VIOLATION, 'task_workspace_branch_uidx')) {
        throw new TaskBranchTakenError(written.branch.value);
      }

      if (
        written.proposedIn &&
        violates(error, UNIQUE_VIOLATION, 'task_proposed_in_uidx')
      ) {
        throw new ProposalAlreadyOpenedError(
          written.proposedIn.chatId.value,
          written.proposedIn.position.value,
        );
      }

      throw error;
    }
  }

  private async stored(saved: Task): Promise<void> {
    const written = await this.translated(saved, () =>
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
          workspaceReleasedAt: saved.workspaceRelease.releasedAt,
          assigneeId: saved.assignee?.value ?? null,
          revision: saved.revision.value,
          isSetup: saved.isSetup,
          setupOpen: saved.setupOpen,
          unreadAsk: saved.hasUnreadAsk,
          draftGeneration: saved.draftGeneration.value,
          awaitedTurnAttempt: saved.awaitedTurn?.attempt ?? null,
          answeredTurnAt: saved.answeredTurnAt,
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
    const held = or(
      ...written.marks.map((mark) =>
        and(eq(taskMark.kind, mark.kind), eq(taskMark.value, mark.value)),
      ),
    );

    await this.context.db
      .delete(taskMark)
      .where(
        and(
          eq(taskMark.taskId, written.id.value),
          held ? not(held) : undefined,
        ),
      );

    if (written.heldMarks.length === 0) {
      return;
    }

    await this.context.db
      .insert(taskMark)
      .values(
        written.heldMarks.map((each) => ({
          workspaceId: written.workspaceId.value,
          taskId: written.id.value,
          kind: each.mark.kind,
          value: each.mark.value,
          heldSince: each.since,
        })),
      )
      .onConflictDoNothing({
        target: [taskMark.taskId, taskMark.kind, taskMark.value],
      });
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
        heldSince: taskMark.heldSince,
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

  async findByCorrelation(
    workspaceId: WorkspaceId,
    correlationKeys: CorrelationKeys,
  ): Promise<readonly Task[]> {
    const named = correlationKeys.branch
      ? eq(task.branch, correlationKeys.branch.value)
      : undefined;
    const marked = correlationKeys.marks.length
      ? inArray(task.id, this.holdersOf(workspaceId, correlationKeys.marks))
      : undefined;

    if (!named && !marked) {
      return [];
    }

    const found = await this.context.db
      .select()
      .from(task)
      .where(
        and(
          eq(task.workspaceId, workspaceId.value),
          named && marked ? or(named, marked) : (named ?? marked),
        ),
      )
      .orderBy(task.id)
      .for('update');

    return this.whole(found);
  }

  async holdingMark(
    workspaceId: WorkspaceId,
    mark: Mark,
  ): Promise<readonly Task[]> {
    const found = await this.context.db
      .select()
      .from(task)
      .where(inArray(task.id, this.holdersOf(workspaceId, [mark])));

    return this.whole(found);
  }

  private holdersOf(workspaceId: WorkspaceId, marks: readonly Mark[]) {
    return this.context.db
      .select({ id: taskMark.taskId })
      .from(taskMark)
      .where(
        and(
          eq(taskMark.workspaceId, workspaceId.value),
          or(
            ...marks.map((mark) =>
              and(eq(taskMark.kind, mark.kind), eq(taskMark.value, mark.value)),
            ),
          ),
        ),
      );
  }

  async remove(removed: Task): Promise<void> {
    await this.context.inTransaction(async () => {
      const gone = await this.context.db
        .delete(task)
        .where(
          and(eq(task.id, removed.id.value), eq(task.version, removed.version)),
        )
        .returning({ id: task.id });

      if (gone.length === 0) {
        throw new TaskVersionConflictError(removed.id.value);
      }

      await this.events.dispatch(removed.pullEvents());
    });
  }

  async settingUpFor(teamId: TeamId): Promise<Task | null> {
    const [found] = await this.openSetups(eq(workStation.teamId, teamId.value));

    return found ?? null;
  }

  async settingUpIn(workspaceId: WorkspaceId): Promise<readonly Task[]> {
    return this.openSetups(eq(task.workspaceId, workspaceId.value));
  }

  async settingUp(): Promise<readonly Task[]> {
    return this.openSetups();
  }

  async withTurnAnsweredBetween(
    after: Date,
    before: Date,
  ): Promise<readonly Task[]> {
    const found = await this.context.db
      .select()
      .from(task)
      .where(
        and(
          isNotNull(task.currentRunId),
          gt(task.answeredTurnAt, after),
          lt(task.answeredTurnAt, before),
        ),
      );

    return this.whole(found);
  }

  async awaitingConnection(
    teamId: TeamId,
    personId: UserId,
    integration: IntegrationName,
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
                sql`(${taskNote.connectionAsk}->>'integration') = ${integration.value}`,
                sql`(${taskNote.connectionAsk}->>'teamId') = ${teamId.value}`,
                sql`(${taskNote.connectionAsk}->>'met')::boolean = false`,
              ),
            ),
        ),
      );

    return this.whole(found);
  }

  private async openSetups(of?: SQL): Promise<Task[]> {
    const found = await this.context.db
      .select({ task })
      .from(task)
      .innerJoin(workStation, eq(workStation.stationId, task.stationId))
      .where(and(eq(task.setupOpen, true), of));

    return this.whole(found.map((each) => each.task));
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
          stationId: note.stationId.value,
          body: note.body.value,
          at: note.at,
          anchor: note.anchor?.parts ?? null,
          answeredAt: note.answeredAt,
          voice: note.voice.kind,
          authorId: note.voice.author?.value ?? null,
          coAuthorIds: note.voice.coAuthors.map((each) => each.value),
          runId: note.voice.run?.value ?? null,
          kind: note.kind,
          closesConversation: saved.closesAConversationAt(note.position),
          readAt: note.readAt,
          acknowledgedAt: note.acknowledgedAt,
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
          acknowledgedAt: sql`excluded.acknowledged_at`,
          answeredAt: sql`excluded.answered_at`,
          approval: sql`excluded.approval`,
          failure: sql`excluded.failure`,
          connectionAsk: sql`excluded.connection_ask`,
          closesConversation: sql`excluded.closes_conversation`,
        },
      });
  }
}
