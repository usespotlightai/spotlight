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
import { firstOf } from '@shared-kernel/domain/item-at';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { CheckoutHead } from '@shared-kernel/domain/value-objects/checkout-head.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
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
import { Hold } from '@work/domain/entities/hold.entity';
import { TaskNote } from '@work/domain/entities/task-note.entity';
import { ProposalAlreadyOpenedError } from '@work/domain/exceptions/proposal-already-opened.error';
import { TaskBranchTakenError } from '@work/domain/exceptions/task-branch-taken.error';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Anchor } from '@work/domain/value-objects/anchor.vo';
import { ApprovalIntent } from '@work/domain/value-objects/approval-intent.vo';
import { Approval } from '@work/domain/value-objects/approval.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { AwaitedTurn } from '@work/domain/value-objects/awaited-turn.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { CommitSha } from '@work/domain/value-objects/commit-sha.vo';
import { ConnectionAsk } from '@work/domain/value-objects/connection-ask.vo';
import type { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import { DeferredMove } from '@work/domain/value-objects/deferred-move.vo';
import { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { HeldMark } from '@work/domain/value-objects/held-mark.vo';
import { HoldId } from '@work/domain/value-objects/hold-id.vo';
import { IntegrationName } from '@work/domain/value-objects/integration-name.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { OwnedPullRequest } from '@work/domain/value-objects/owned-pull-request.vo';
import { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import { PushedHead } from '@work/domain/value-objects/pushed-head.vo';
import { Resumption } from '@work/domain/value-objects/resumption.vo';
import { ReviewedPullRequest } from '@work/domain/value-objects/reviewed-pull-request.vo';
import { RunNotStarted } from '@work/domain/value-objects/run-not-started.vo';
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
  taskPullRequest,
  taskPushedHead,
  taskHold,
} from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { workStation } from '@work/infrastructure/persistence/drizzle/schemas/work-station.schema';
import {
  and,
  asc,
  desc,
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
      nonEmpty(row.decidedBy) && nonEmpty(row.decidedAt)
        ? {
            by: UserId.of(row.decidedBy),
            at: new Date(row.decidedAt),
            reason: row.reason ?? '',
          }
        : null,
    spent: row.spent,
    edited: toEditedCall(row),
    intent: nonEmpty(row.intent) ? ApprovalIntent.rehydrate(row.intent) : null,
    askedOf: nonEmpty(row.askedOf) ? UserId.of(row.askedOf) : null,
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
    station: row.station === null ? null : StationName.of(row.station),
    stationId: StationId.of(row.stationId),
    body: TaskNoteBody.of(row.body),
    at: row.at,
    voice: Voice.of({
      kind: row.voice,
      author: row.authorId,
      coAuthors: row.coAuthorIds,
      run: row.runId,
      source: row.source,
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
    resumption: row.resumption
      ? Resumption.rehydrate({
          next: row.resumption.next,
          station: StationName.of(row.resumption.station),
          summary: row.resumption.summary,
        })
      : null,
    suggestsClosing: row.suggestsClosing,
  });

type HoldRow = typeof taskHold.$inferSelect;

const toHold = (row: HoldRow): Hold =>
  Hold.rehydrate({
    id: HoldId.of(row.id),
    by: UserId.of(row.heldBy),
    chat: nonEmpty(row.chatId) ? ChatId.of(row.chatId) : null,
    stationId: StationId.of(row.stationId),
    from: nonEmpty(row.fromRunId) ? RunId.of(row.fromRunId) : null,
    verdict: row.verdict,
    turns: row.turnRunIds.map((each) => RunId.of(each)),
    heldMove: nonEmpty(row.heldMoveTo) ? StationId.of(row.heldMoveTo) : null,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    end: row.end,
    fromHeads: row.fromHeads.map((each) => CheckoutHead.rehydrate(each)),
    toHeads: row.toHeads.map((each) => CheckoutHead.rehydrate(each)),
  });

const toTask = (
  row: Row,
  notes: NoteRow[],
  attachments: AttachmentRow[],
  marks: MarkRow[],
  ownedPullRequests: OwnedPullRequestRow[],
  holds: HoldRow[],
  pushedHeads: PushedHeadRow[],
): Task =>
  Task.rehydrate({
    attachments: toAttachments(attachments, null),
    id: TaskId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    stationId: StationId.of(row.stationId),
    title: TaskTitle.of(row.title),
    branch: Branch.of(row.branch),
    base: nonEmpty(row.base) ? Branch.of(row.base) : null,
    description: nonEmpty(row.description)
      ? TaskDescription.of(row.description)
      : null,
    rank: TaskRank.of(row.rank),
    currentRunId: nonEmpty(row.currentRunId)
      ? RunId.of(row.currentRunId)
      : null,
    session: nonEmpty(row.sessionId) ? HarnessSession.of(row.sessionId) : null,
    claimedBy: nonEmpty(row.runnerId) ? RunnerId.of(row.runnerId) : null,
    notes: notes.map((note) => toNote(note, attachments)),
    createdAt: row.createdAt,
    originStationId: nonEmpty(row.originStationId)
      ? StationId.of(row.originStationId)
      : null,
    createdBy: nonEmpty(row.createdById) ? UserId.of(row.createdById) : null,
    openedFrom: TaskOrigin.decode(row.openedFrom),
    proposedIn:
      row.proposedInChatId !== null && row.proposedInPosition !== null
        ? ProposalOrigin.of({
            chatId: ChatId.of(row.proposedInChatId),
            position: MessagePosition.of(row.proposedInPosition),
          })
        : null,
    assignee: nonEmpty(row.assigneeId) ? UserId.of(row.assigneeId) : null,
    finishedAt: row.finishedAt,
    draftGeneration: DraftGeneration.of(row.draftGeneration),
    awaitedTurn:
      row.awaitedTurnAttempt !== null &&
      row.currentRunId !== null &&
      row.currentRunId !== ''
        ? AwaitedTurn.of(RunId.of(row.currentRunId), row.awaitedTurnAttempt)
        : null,
    answeredTurnAt: row.answeredTurnAt,
    revision: TaskRevision.of(row.revision),
    version: row.version,
    reviewedPullRequest: nonEmpty(row.reviewedPullRequest)
      ? ReviewedPullRequest.of(PullRequestUrl.of(row.reviewedPullRequest), {
          outside: row.reviewFromOutside,
        })
      : null,
    moveHeldTo: nonEmpty(row.moveHeldTo) ? StationId.of(row.moveHeldTo) : null,
    runNotStarted:
      nonEmpty(row.notStartedStationId) && nonEmpty(row.notStartedHarness)
        ? RunNotStarted.at(
            StationId.of(row.notStartedStationId),
            HarnessId.of(row.notStartedHarness),
          )
        : null,
    holds: holds.map(toHold),
    heldMarks: marks.map((each) =>
      HeldMark.of(Mark.of(each.kind, each.value), each.heldSince),
    ),
    ownedPullRequests: ownedPullRequests.map((each) =>
      OwnedPullRequest.of(
        PullRequestUrl.of(each.url),
        each.openedAt,
        each.closedAt,
        each.closeRouted,
        each.merged,
      ),
    ),
    pushedHeads: pushedHeads.map((each) =>
      PushedHead.of(
        Repository.of(each.repository),
        CommitSha.of(each.commit),
        each.pushedAt,
        each.holdsOthersCommits,
      ),
    ),
  });

interface PushedHeadRow {
  readonly taskId: string;
  readonly repository: string;
  readonly commit: string;
  readonly pushedAt: Date;
  readonly holdsOthersCommits: boolean;
}

interface OwnedPullRequestRow {
  readonly taskId: string;
  readonly url: string;
  readonly openedAt: Date;
  readonly closedAt: Date | null;
  readonly closeRouted: boolean;
  readonly merged: boolean;
}

interface MarkRow {
  readonly taskId: string;
  readonly kind: string;
  readonly value: string;
  readonly heldSince: Date;
}

interface Parts {
  readonly notes: Map<string, NoteRow[]>;
  readonly attachments: Map<string, AttachmentRow[]>;
  readonly marks: Map<string, MarkRow[]>;
  readonly owned: Map<string, OwnedPullRequestRow[]>;
  readonly holds: Map<string, HoldRow[]>;
  readonly pushed: Map<string, PushedHeadRow[]>;
}

const assembled = (
  rows: readonly Row[],
  { notes, attachments, marks, owned, holds, pushed }: Parts,
): Task[] =>
  rows.map((each) =>
    toTask(
      each,
      notes.get(each.id) ?? [],
      attachments.get(each.id) ?? [],
      marks.get(each.id) ?? [],
      owned.get(each.id) ?? [],
      holds.get(each.id) ?? [],
      pushed.get(each.id) ?? [],
    ),
  );

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
        base: added.base?.value ?? null,
        description: added.description?.value ?? null,
        rank: added.rank.value,
        currentRunId: added.currentRunId?.value ?? null,
        sessionId: added.session?.value ?? null,
        runnerId: added.claimedBy?.value ?? null,
        createdAt: added.createdAt,
        originStationId: added.originStationId?.value ?? null,
        createdById: added.createdBy?.value ?? null,
        openedFrom: added.openedFrom.encoded,
        proposedInChatId: added.proposedIn?.chatId.value ?? null,
        proposedInPosition: added.proposedIn?.position.value ?? null,
        assigneeId: added.assignee?.value ?? null,
        reviewedPullRequest: added.reviewedPullRequest?.url.value ?? null,
        reviewFromOutside: added.fromOutside,
        moveHeldTo: added.moveHeldTo?.value ?? null,
        notStartedStationId: added.runNotStarted?.stationId.value ?? null,
        notStartedHarness: added.runNotStarted?.harness.value ?? null,
        finishedAt: added.finishedAt,
        workingCopyReleasedAt: added.workingCopyRelease.releasedAt,
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
    await this.writeOwnedPullRequests(added);
    await this.writeHolds(added);
    await this.writePushedHeads(added);
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
          sessionId: saved.session?.value ?? null,
          runnerId: saved.claimedBy?.value ?? null,
          reviewedPullRequest: saved.reviewedPullRequest?.url.value ?? null,
          reviewFromOutside: saved.fromOutside,
          moveHeldTo: saved.moveHeldTo?.value ?? null,
          notStartedStationId: saved.runNotStarted?.stationId.value ?? null,
          notStartedHarness: saved.runNotStarted?.harness.value ?? null,
          finishedAt: saved.finishedAt,
          workingCopyReleasedAt: saved.workingCopyRelease.releasedAt,
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
    await this.writeOwnedPullRequests(saved);
    await this.writeHolds(saved);
    await this.writePushedHeads(saved);
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

  private async writeOwnedPullRequests(written: Task): Promise<void> {
    if (written.ownedPullRequests.length === 0) {
      return;
    }

    await this.context.db
      .insert(taskPullRequest)
      .values(
        written.ownedPullRequests.map((each) => ({
          workspaceId: written.workspaceId.value,
          taskId: written.id.value,
          url: each.url.value,
          openedAt: each.openedAt,
          closedAt: each.closedAt,
          closeRouted: each.closeRouted,
          merged: each.merged,
        })),
      )
      .onConflictDoUpdate({
        target: [taskPullRequest.taskId, taskPullRequest.url],
        set: {
          closedAt: sql`excluded.closed_at`,
          closeRouted: sql`excluded.close_routed`,
          merged: sql`excluded.merged`,
        },
      });
  }

  private async writePushedHeads(written: Task): Promise<void> {
    if (written.pushedHeads.length === 0) {
      return;
    }

    await this.context.db
      .insert(taskPushedHead)
      .values(
        written.pushedHeads.map((each) => ({
          workspaceId: written.workspaceId.value,
          taskId: written.id.value,
          repository: each.repository.value,
          commit: each.commit.value,
          pushedAt: each.pushedAt,
          holdsOthersCommits: each.holdsOthersCommits,
        })),
      )
      .onConflictDoUpdate({
        target: [taskPushedHead.taskId, taskPushedHead.repository],
        set: {
          commit: sql`excluded.commit`,
          pushedAt: sql`excluded.pushed_at`,
          holdsOthersCommits: sql`excluded.holds_others_commits`,
        },
      });
  }

  private async pushedHeadsFor(
    taskIds: string[],
  ): Promise<Map<string, PushedHeadRow[]>> {
    if (taskIds.length === 0) {
      return new Map();
    }

    const rows = await this.context.db
      .select({
        taskId: taskPushedHead.taskId,
        repository: taskPushedHead.repository,
        commit: taskPushedHead.commit,
        pushedAt: taskPushedHead.pushedAt,
        holdsOthersCommits: taskPushedHead.holdsOthersCommits,
      })
      .from(taskPushedHead)
      .where(inArray(taskPushedHead.taskId, taskIds));

    return rows.reduce((pushed, row) => {
      pushed.set(row.taskId, [...(pushed.get(row.taskId) ?? []), row]);
      return pushed;
    }, new Map<string, PushedHeadRow[]>());
  }

  private async ownedPullRequestsFor(
    taskIds: string[],
  ): Promise<Map<string, OwnedPullRequestRow[]>> {
    if (taskIds.length === 0) {
      return new Map();
    }

    const rows = await this.context.db
      .select({
        taskId: taskPullRequest.taskId,
        url: taskPullRequest.url,
        openedAt: taskPullRequest.openedAt,
        closedAt: taskPullRequest.closedAt,
        closeRouted: taskPullRequest.closeRouted,
        merged: taskPullRequest.merged,
      })
      .from(taskPullRequest)
      .where(inArray(taskPullRequest.taskId, taskIds))
      .orderBy(asc(taskPullRequest.openedAt), asc(taskPullRequest.url));

    return rows.reduce((opened, row) => {
      opened.set(row.taskId, [...(opened.get(row.taskId) ?? []), row]);
      return opened;
    }, new Map<string, OwnedPullRequestRow[]>());
  }

  private async holdsFor(taskIds: string[]): Promise<Map<string, HoldRow[]>> {
    if (taskIds.length === 0) {
      return new Map();
    }

    const rows = await this.context.db
      .select()
      .from(taskHold)
      .where(inArray(taskHold.taskId, taskIds))
      .orderBy(asc(taskHold.startedAt), asc(taskHold.id));

    return rows.reduce((taken, row) => {
      taken.set(row.taskId, [...(taken.get(row.taskId) ?? []), row]);
      return taken;
    }, new Map<string, HoldRow[]>());
  }

  private async writeHolds(written: Task): Promise<void> {
    if (written.holds.length === 0) {
      return;
    }

    await this.context.db
      .insert(taskHold)
      .values(
        written.holds.map((each) => ({
          id: each.id.value,
          workspaceId: written.workspaceId.value,
          taskId: written.id.value,
          stationId: each.stationId.value,
          heldBy: each.by.value,
          chatId: each.chat?.value ?? null,
          fromRunId: each.from?.value ?? null,
          verdict: each.verdict,
          turnRunIds: each.turns.map((turn) => turn.value),
          heldMoveTo: each.heldMove?.value ?? null,
          fromHeads: each.fromHeads.map((head) => head.parts),
          toHeads: each.toHeads.map((head) => head.parts),
          end: each.end,
          startedAt: each.startedAt,
          endedAt: each.endedAt,
        })),
      )
      .onConflictDoUpdate({
        target: taskHold.id,
        set: {
          verdict: sql`excluded.verdict`,
          turnRunIds: sql`excluded.turn_run_ids`,
          heldMoveTo: sql`excluded.held_move_to`,
          fromHeads: sql`excluded.from_heads`,
          toHeads: sql`excluded.to_heads`,
          end: sql`excluded.hold_end`,
          endedAt: sql`excluded.ended_at`,
        },
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
    return assembled(rows, await this.partsFor(rows.map((each) => each.id)));
  }

  // The row comes first: a part written after it changes the version, so a save from a mixed read conflicts.
  private async partsFor(ids: string[]): Promise<Parts> {
    const [notes, attachments, marks, owned, holds, pushed] =
      await this.context.concurrently(
        () => this.notesFor(ids),
        () => this.attachmentsFor(ids),
        () => this.marksFor(ids),
        () => this.ownedPullRequestsFor(ids),
        () => this.holdsFor(ids),
        () => this.pushedHeadsFor(ids),
      );

    return { notes, attachments, marks, owned, holds, pushed };
  }

  async find(id: TaskId): Promise<Task | null> {
    const found = firstOf(
      await this.context.db
        .select()
        .from(task)
        .where(eq(task.id, id.value))
        .limit(1),
    );

    return found ? ((await this.whole([found]))[0] ?? null) : null;
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

  async onBranch(
    workspaceId: WorkspaceId,
    branch: Branch,
  ): Promise<Task | null> {
    const found = await this.context.db
      .select()
      .from(task)
      .where(
        and(
          eq(task.workspaceId, workspaceId.value),
          eq(task.branch, branch.value),
        ),
      )
      .limit(1);

    return (await this.whole(found))[0] ?? null;
  }

  async startingFrom(
    workspaceId: WorkspaceId,
    base: Branch,
  ): Promise<readonly Task[]> {
    const found = await this.context.db
      .select()
      .from(task)
      .where(
        and(eq(task.workspaceId, workspaceId.value), eq(task.base, base.value)),
      );

    return this.whole(found);
  }

  async owningPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<Task | null> {
    const found = await this.context.db
      .select()
      .from(task)
      .where(
        inArray(
          task.id,
          this.context.db
            .select({ id: taskPullRequest.taskId })
            .from(taskPullRequest)
            .where(
              and(
                eq(taskPullRequest.workspaceId, workspaceId.value),
                eq(taskPullRequest.url, pullRequest.value),
              ),
            ),
        ),
      )
      .orderBy(desc(task.createdAt), task.id)
      .limit(1)
      .for('update');

    return (await this.whole(found))[0] ?? null;
  }

  async reviewingPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<Task | null> {
    const found = await this.context.db
      .select()
      .from(task)
      .where(
        and(
          eq(task.workspaceId, workspaceId.value),
          eq(task.reviewedPullRequest, pullRequest.value),
        ),
      )
      .orderBy(desc(task.createdAt), task.id)
      .limit(1);

    return (await this.whole(found))[0] ?? null;
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
    const found = firstOf(
      await this.openSetups(eq(workStation.teamId, teamId.value)),
    );

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
          station: note.station?.value ?? null,
          stationId: note.stationId.value,
          body: note.body.value,
          at: note.at,
          anchor: note.anchor?.parts ?? null,
          answeredAt: note.answeredAt,
          voice: note.voice.kind,
          authorId: note.voice.author?.value ?? null,
          source: note.voice.source?.value ?? null,
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
          resumption: note.resumption
            ? {
                next: note.resumption.next,
                station: note.resumption.station.value,
                summary: note.resumption.summary,
              }
            : null,
          suggestsClosing: note.suggestsClosing,
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
