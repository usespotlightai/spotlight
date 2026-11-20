import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Hold } from '@work/domain/entities/hold.entity';
import {
  TaskNote,
  type TaskNoteForm,
  type TaskNoteKind,
} from '@work/domain/entities/task-note.entity';
import { LineResumed } from '@work/domain/events/line-resumed.event';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { PullRequestReviewTaken } from '@work/domain/events/pull-request-review-taken.event';
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import { TaskApprovalClaimed } from '@work/domain/events/task-approval-claimed.event';
import { TaskApprovalReturned } from '@work/domain/events/task-approval-returned.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskAssigned } from '@work/domain/events/task-assigned.event';
import { TaskConversationRead } from '@work/domain/events/task-conversation-read.event';
import { TaskConversationReopened } from '@work/domain/events/task-conversation-reopened.event';
import { TaskDeleted } from '@work/domain/events/task-deleted.event';
import { TaskDraftSent } from '@work/domain/events/task-draft-sent.event';
import { TaskFailed } from '@work/domain/events/task-failed.event';
import { TaskFinished } from '@work/domain/events/task-finished.event';
import { TaskHeld } from '@work/domain/events/task-held.event';
import { TaskMarkReleased } from '@work/domain/events/task-mark-released.event';
import { TaskMarked } from '@work/domain/events/task-marked.event';
import { TaskMoved } from '@work/domain/events/task-moved.event';
import { TaskNoted } from '@work/domain/events/task-noted.event';
import { TaskNotesAcknowledged } from '@work/domain/events/task-notes-acknowledged.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import { TaskPassed } from '@work/domain/events/task-passed.event';
import { TaskPullRequestClosed } from '@work/domain/events/task-pull-request-closed.event';
import { TaskPullRequestReopened } from '@work/domain/events/task-pull-request-reopened.event';
import { TaskReordered } from '@work/domain/events/task-reordered.event';
import { TaskRunAssigned } from '@work/domain/events/task-run-assigned.event';
import { TaskRunDetached } from '@work/domain/events/task-run-detached.event';
import { TaskRunEnded } from '@work/domain/events/task-run-ended.event';
import { TaskSessionKept } from '@work/domain/events/task-session-kept.event';
import { TaskTurnAwaited } from '@work/domain/events/task-turn-awaited.event';
import { AssignedToAnotherPersonError } from '@work/domain/exceptions/assigned-to-another-person.error';
import { DraftAlreadySentError } from '@work/domain/exceptions/draft-already-sent.error';
import { InvalidApprovalAnswerError } from '@work/domain/exceptions/invalid-approval-answer.error';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { MoveDeniedError } from '@work/domain/exceptions/move-denied.error';
import { NoRepositoryError } from '@work/domain/exceptions/no-repository.error';
import { NotATeamMemberError } from '@work/domain/exceptions/not-a-team-member.error';
import { NotOnTheTeamAskedError } from '@work/domain/exceptions/not-on-the-team-asked.error';
import { NothingSaidError } from '@work/domain/exceptions/nothing-said.error';
import { ReopenedByNobodyError } from '@work/domain/exceptions/reopened-by-nobody.error';
import { StaleTaskRevisionError } from '@work/domain/exceptions/stale-task-revision.error';
import { TaskNotReopenableError } from '@work/domain/exceptions/task-not-reopenable.error';
import { TaskOnHoldError } from '@work/domain/exceptions/task-on-hold.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { UnreviewablePullRequestError } from '@work/domain/exceptions/unreviewable-pull-request.error';
import {
  ConversationAudience,
  type ConversationStanding,
  type ConversationViewer,
} from '@work/domain/services/conversation-audience';
import {
  type Conversation,
  notesIn,
  reopenable,
  worksOn,
} from '@work/domain/services/conversations';
import { deferralIn } from '@work/domain/services/deferred-moves';
import { Placement } from '@work/domain/services/placement';
import { type Outcome, ReactionFor } from '@work/domain/services/reaction-for';
import { openSetupList } from '@work/domain/services/setup-list';
import { takesUpRun } from '@work/domain/services/taking-up';
import { anyUnread } from '@work/domain/services/unread';
import type { Anchor } from '@work/domain/value-objects/anchor.vo';
import type { ApprovalCheck } from '@work/domain/value-objects/approval-check';
import type { ApprovalIntent } from '@work/domain/value-objects/approval-intent.vo';
import type { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import type { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import {
  Approval,
  type ApprovalDecision,
  type ApprovalEdits,
} from '@work/domain/value-objects/approval.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import { AwaitedTurn } from '@work/domain/value-objects/awaited-turn.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import type { ConnectionAsk } from '@work/domain/value-objects/connection-ask.vo';
import { DeferredMove } from '@work/domain/value-objects/deferred-move.vo';
import type { RunDriver } from '@work/domain/value-objects/dispatch-subject';
import { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { HeldMark } from '@work/domain/value-objects/held-mark.vo';
import type { HoldEnd } from '@work/domain/value-objects/hold-end';
import type { HoldId } from '@work/domain/value-objects/hold-id.vo';
import type { HoldVerdict } from '@work/domain/value-objects/hold-verdict';
import type { IntegrationName } from '@work/domain/value-objects/integration-name.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { OwnedPullRequest } from '@work/domain/value-objects/owned-pull-request.vo';
import type { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import type { PullRequestStep } from '@work/domain/value-objects/pull-request-step';
import type { ResolvedHandover } from '@work/domain/value-objects/resolved-handover.vo';
import { Resume } from '@work/domain/value-objects/resume.vo';
import { Resumption } from '@work/domain/value-objects/resumption.vo';
import type { ReviewComment } from '@work/domain/value-objects/review-comment.vo';
import {
  type ReviewedHead,
  ReviewedPullRequest,
} from '@work/domain/value-objects/reviewed-pull-request.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import type { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import type { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';
import type { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import type { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import type { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { Trail } from '@work/domain/value-objects/trail.vo';
import type { TurnHeads } from '@work/domain/value-objects/turn-heads.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { WorkingCopyRelease } from '@work/domain/value-objects/working-copy-release.vo';

export interface OpeningCandidates {
  readonly named: UserId | null;
  readonly lineDefault: UserId | null;
}

export interface OpenReviewComment {
  readonly at: NotePosition;
  readonly anchor: Anchor;
}

export interface ReviewCommentToReply {
  readonly pullRequest: PullRequestUrl;
  readonly repository: Repository;
  readonly reviewComment: ReviewComment;
}

export interface NewNote {
  readonly line: LineMap | null;
  readonly body: TaskNoteBody;
  readonly at: Date;
  readonly voice: Voice;
  readonly anchor?: Anchor | null;
  readonly form?: TaskNoteForm;
  readonly attachments?: readonly Attachment[];
  readonly approval?: Approval | null;
  readonly failure?: TaskFailure | null;
  readonly connectionAsk?: ConnectionAsk | null;
  readonly resumption?: Resumption | null;
  readonly suggestsClosing?: boolean;
}

export interface CurrentApproval {
  readonly at: NotePosition;
  readonly approval: Approval;
}

export interface AskedToConnect {
  readonly task: Task;
  readonly asked: boolean;
}

export interface HeldMoveOn {
  readonly line: LineMap | null;
  readonly ranksAtHeldMove: readonly TaskRank[];
}

export interface Cleared {
  readonly task: Task;
  readonly check: ApprovalCheck;
}

export class Task extends EventRecorder {
  private constructor(
    readonly id: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly stationId: StationId,
    readonly title: TaskTitle,
    readonly branch: Branch,
    readonly description: TaskDescription | null,
    readonly rank: TaskRank,
    readonly currentRunId: RunId | null,
    readonly session: HarnessSession | null,
    readonly claimedBy: RunnerId | null,
    readonly notes: readonly TaskNote[],
    readonly createdAt: Date,
    readonly originStationId: StationId | null,
    readonly createdBy: UserId | null,
    readonly openedFrom: TaskOrigin,
    readonly reviewedPullRequest: ReviewedPullRequest | null,
    readonly heldMarks: readonly HeldMark[],
    readonly finishedAt: Date | null,
    readonly assignee: UserId | null,
    readonly attachments: readonly Attachment[],
    readonly proposedIn: ProposalOrigin | null,
    readonly draftGeneration: DraftGeneration = DraftGeneration.first(),
    readonly revision: TaskRevision = TaskRevision.first(),
    readonly version: number = 0,
    readonly awaitedTurn: AwaitedTurn | null = null,
    readonly answeredTurnAt: Date | null = null,
    readonly ownedPullRequests: readonly OwnedPullRequest[] = [],
    readonly moveHeldTo: StationId | null = null,
    readonly holds: readonly Hold[] = [],
  ) {
    super();
  }

  static add(input: {
    line: LineMap;
    at: StationId;
    title: TaskTitle;
    description?: TaskDescription | null;
    attachments?: readonly Attachment[];
    rank: TaskRank;
    createdBy?: UserId | null;
    receivedFrom?: Happening | null;
    proposedIn?: ProposalOrigin | null;
    now: Date;
    newId: () => string;
  }): Task {
    const station = Task.stationOn(input.line, input.at);

    if (station.isCompleted) {
      throw new InvalidTaskTransitionError(
        `A task cannot open at ${station.name.value}. That station ends its line.`,
      );
    }

    const createdBy = input.createdBy ?? null;
    const receivedFrom = input.receivedFrom ?? null;

    const id = TaskId.of(input.newId());
    const task = new Task(
      id,
      input.line.workspaceId,
      station.id,
      input.title,
      Branch.for(id, input.title),
      input.description ?? null,
      input.rank,
      null,
      null,
      null,
      [],
      input.now,
      station.id,
      createdBy,
      receivedFrom
        ? TaskOrigin.receivedFrom(receivedFrom)
        : TaskOrigin.person(),
      null,
      [],
      null,
      createdBy,
      input.attachments ?? [],
      input.proposedIn ?? null,
    );

    task.record(
      new TaskOpened(
        task.id,
        task.workspaceId,
        input.line.teamId,
        input.line.id,
        task.stationId,
        createdBy,
        input.now,
        receivedFrom !== null,
        input.proposedIn ?? null,
      ),
    );

    return task;
  }

  static revisionsOfLatestRunHere(
    revision: TaskRevision,
  ): readonly TaskRevision[] {
    return revision.value === 0
      ? [revision]
      : [revision, TaskRevision.of(revision.value - 1)];
  }

  static rehydrate(input: {
    id: TaskId;
    workspaceId: WorkspaceId;
    stationId: StationId;
    title: TaskTitle;
    branch: Branch;
    description: TaskDescription | null;
    rank: TaskRank;
    currentRunId: RunId | null;
    session: HarnessSession | null;
    claimedBy: RunnerId | null;
    notes: readonly TaskNote[];
    createdAt: Date;
    originStationId: StationId | null;
    createdBy: UserId | null;
    openedFrom: TaskOrigin;
    reviewedPullRequest?: ReviewedPullRequest | null;
    heldMarks?: readonly HeldMark[];
    finishedAt: Date | null;
    assignee?: UserId | null;
    attachments?: readonly Attachment[];
    proposedIn?: ProposalOrigin | null;
    draftGeneration?: DraftGeneration;
    revision: TaskRevision;
    version: number;
    awaitedTurn?: AwaitedTurn | null;
    answeredTurnAt?: Date | null;
    ownedPullRequests?: readonly OwnedPullRequest[];
    moveHeldTo?: StationId | null;
    holds?: readonly Hold[];
  }): Task {
    if (input.version < 0) {
      throw new InconsistentStateError('task', 'has a negative version');
    }
    if (input.finishedAt !== null && input.currentRunId !== null) {
      throw new InconsistentStateError(
        'task',
        'is finished yet still has a current run',
      );
    }

    if (input.notes.some((note, place) => note.position.value !== place)) {
      throw new InconsistentStateError('task', 'has a gap in its trail');
    }

    const owned = input.ownedPullRequests ?? [];

    if (owned.length > 0 && input.reviewedPullRequest) {
      throw new InconsistentStateError(
        'task',
        'reviews a pull request and owns pull requests too',
      );
    }

    const opened = owned.flatMap((each) =>
      each.url.repository ? [each.url.repository] : [],
    );

    if (
      opened.some((each, at) =>
        opened.slice(at + 1).some((other) => other.equals(each)),
      )
    ) {
      throw new InconsistentStateError(
        'task',
        'has two pull requests in one repository',
      );
    }

    if (input.reviewedPullRequest && !input.reviewedPullRequest.reviewedHead) {
      throw new InconsistentStateError(
        'task',
        'reviews a pull request whose head it cannot check out',
      );
    }

    if (input.moveHeldTo && owned.every((each) => each.settled)) {
      throw new InconsistentStateError(
        'task',
        'holds a move for its pull requests to close, yet all of them are closed',
      );
    }

    const holds = input.holds ?? [];
    const open = holds.filter((each) => each.open);

    if (open.length > 1) {
      throw new InconsistentStateError('task', 'has two open holds');
    }

    if (
      input.notes.filter((note) => note.form === 'held').length !== holds.length
    ) {
      throw new InconsistentStateError(
        'task',
        'does not note each of its holds once',
      );
    }

    if (
      open[0] &&
      (input.finishedAt !== null || !open[0].stationId.equals(input.stationId))
    ) {
      throw new InconsistentStateError(
        'task',
        'is on hold at a station it has left, or after it finished',
      );
    }

    const running = input.currentRunId;

    if (open[0] && running && !open[0].drives(running)) {
      throw new InconsistentStateError(
        'task',
        'is on hold yet runs a line run',
      );
    }

    if (open[0] && !(input.assignee?.equals(open[0].by) ?? false)) {
      throw new InconsistentStateError(
        'task',
        'is on hold for one person and assigned to another',
      );
    }

    const task = new Task(
      input.id,
      input.workspaceId,
      input.stationId,
      input.title,
      input.branch,
      input.description,
      input.rank,
      input.currentRunId,
      input.session,
      input.claimedBy,
      input.notes,
      input.createdAt,
      input.originStationId,
      input.createdBy,
      input.openedFrom,
      input.reviewedPullRequest ?? null,
      input.heldMarks ?? [],
      input.finishedAt,
      input.assignee ?? null,
      input.attachments ?? [],
      input.proposedIn ?? null,
      input.draftGeneration ?? DraftGeneration.first(),
      input.revision,
      input.version,
      input.awaitedTurn ?? null,
      input.answeredTurnAt ?? null,
      owned,
      input.moveHeldTo ?? null,
      holds,
    );

    if (
      task.awaitedTurn &&
      !(task.hasCurrentRun(task.awaitedTurn.runId) && task.awaitingReview)
    ) {
      throw new InconsistentStateError(
        'task',
        'awaits the turn of a run it does not hold, or awaits no person',
      );
    }

    return task;
  }

  assertRevision(revision: TaskRevision): Task {
    if (!this.revision.equals(revision)) {
      throw new StaleTaskRevisionError(
        this.id.value,
        revision.value,
        this.revision.value,
      );
    }

    return this;
  }

  isAtRevision(revision: TaskRevision): boolean {
    return this.revision.equals(revision);
  }

  moveTo(
    line: LineMap,
    to: StationId,
    rank: TaskRank,
    newNote: NewNote,
    handMove: { mover: UserId },
    turnHeads: readonly TurnHeads[] = [],
  ): Task {
    const hold = this.openHold;

    if (hold && !hold.by.equals(handMove.mover)) {
      throw new TaskOnHoldError(this.id, hold.by);
    }

    if (hold && this.stationId.equals(to)) {
      this.assertNotOnHold('move it within its station');
    }

    this.assertHandMoveAllowed(line, to);

    const into = Task.stationOn(line, to);
    const next: HoldEnd = into.isCompleted ? 'finish' : 'move-on';
    const ending = hold
      ? this.endedHold({
          hold,
          line,
          next,
          into,
          summary: null,
          verdict: null,
          turnHeads,
          voice: Voice.person(handMove.mover),
          at: newNote.at,
        })
      : null;
    const moved = ending
      ? this.recordedResume(
          ending.closed.relocated(line, to, rank, ending.newNote, handMove),
          ending.ended,
          next,
          line,
        )
      : this.relocated(line, to, rank, newNote, handMove).detachRun(
          this.currentRunId,
        );

    moved.record(
      new TaskActedOn(
        this.id,
        this.workspaceId,
        this.stationId,
        into.isCompleted ? 'accepted' : into.isBacklog ? 'parked' : 'started',
        handMove.mover,
        this.lastRun,
        newNote.at,
      ),
    );

    return moved;
  }

  react(line: LineMap, to: StationId, rank: TaskRank, newNote: NewNote): Task {
    if (!this.movableByHappeningTo(line, to)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has a run in progress. A happening can move it only to the completed station, or while its run waits on a person's answer to a question.`,
      );
    }

    return this.relocated(line, to, rank, newNote, null).detachRun(
      this.currentRunId,
    );
  }

  movableByHappeningTo(line: LineMap, to: StationId): boolean {
    return (
      !this.onHold &&
      (!this.running || line.completed.id.equals(to) || this.waitsOnAQuestion)
    );
  }

  private get waitsOnAQuestion(): boolean {
    const asked = this.pendingAsk;

    return asked !== null && !asked.approval && !asked.connectionAsk;
  }

  deferMove(line: LineMap, to: StationId, newNote: NewNote): Task {
    const hold = this.openHold;

    if (hold && this.stationId.equals(to)) {
      return this.heldAside(newNote);
    }

    if (hold) {
      return this.heldAside({
        ...newNote,
        body: TaskNoteBody.movesOnResume(
          Task.stationOn(line, to).name,
          newNote.body,
        ),
      }).with({
        holds: this.replacedHold(hold.holdingMoveTo(to)),
      });
    }

    if (!this.running) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has no run in progress. There is no move to defer.`,
      );
    }

    if (this.stationId.equals(to)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is already at that station.`,
      );
    }

    if (line.completed.id.equals(to)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} cannot defer a move to the end of its line. That move ends its run.`,
      );
    }

    return this.noted(newNote, 'message', DeferredMove.moveTo(to));
  }

  get deferredMoveTo(): StationId | null {
    return deferralIn(this.notes)?.deferredMove?.to ?? null;
  }

  moveAsDeferred(
    by: RunId,
    line: LineMap,
    to: StationId,
    rank: TaskRank,
    ending: { newNote: NewNote; handover: ResolvedHandover },
  ): Task {
    this.assertNoOtherRun(by, 'make its deferred move');

    if (!this.deferredMoveTo?.equals(to)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has no deferred move to that station.`,
      );
    }

    const raised =
      ending.handover.kind === 'review' ? ending.handover.failure : null;
    const failure =
      raised?.following(this.openFailure?.failure ?? null) ?? null;
    const failing = failure
      ? this.failing(failure, by, ending.newNote.at, line.teamId)
      : this;

    const moved = failing.relocated(
      line,
      to,
      rank,
      {
        ...ending.newNote,
        body: TaskNoteBody.movedAsDeferred(
          Task.stationOn(line, to).name,
          ending.handover.account,
        ),
        form: failure ? 'failure' : 'words',
        failure,
      },
      null,
    );

    moved.record(
      new TaskPassed(
        this.id,
        this.workspaceId,
        by,
        this.stationId,
        to,
        ending.newNote.at,
      ),
    );

    return moved;
  }

  private get openFailure(): TaskNote | undefined {
    const open = this.trail.open;

    return open
      ? notesIn(open, this.notes)
          .reverse()
          .find((note) => note.failure !== null)
      : undefined;
  }

  private relocated(
    line: LineMap,
    to: StationId,
    rank: TaskRank,
    newNote: NewNote,
    handMove: { mover: UserId } | null,
  ): Task {
    const from = Task.stationOn(line, this.stationId);
    const into = Task.stationOn(line, to);

    this.assertNotAtStation(into.id);
    this.assertNotOnHold('move it');

    const takesOwnership =
      handMove !== null &&
      !this.assignee &&
      from.isBacklog &&
      into.isAgentStation;

    const moved = this.with({
      stationId: into.id,
      rank,
      currentRunId: null,
      session: null,
      claimedBy: null,
      ...this.appendNote(newNote, 'passed'),
      finishedAt: into.isCompleted ? newNote.at : null,
      ...(takesOwnership ? { assignee: handMove.mover } : {}),
      revision: this.revision.next(),
      moveHeldTo: null,
    }).acknowledgeNotesAt(newNote.at);

    moved.record(
      new TaskMoved(
        moved.id,
        moved.workspaceId,
        { id: from.id, key: from.key },
        { id: into.id, key: into.key },
        newNote.at,
      ),
    );

    if (into.isCompleted) {
      moved.record(
        new TaskFinished(moved.id, moved.workspaceId, into.id, newNote.at),
      );
    }

    return moved;
  }

  reorderTo(rank: TaskRank): Task {
    if (this.rank.equals(rank)) {
      return this;
    }

    const reordered = this.with({ rank });

    reordered.record(
      new TaskReordered(this.id, this.workspaceId, this.stationId, rank),
    );

    return reordered;
  }

  placeAt(
    line: LineMap,
    to: StationId,
    rank: TaskRank,
    newNote: NewNote,
    handMove: { mover: UserId },
    turnHeads: readonly TurnHeads[] = [],
  ): { readonly task: Task; readonly moved: boolean } {
    return this.stationId.equals(to)
      ? { task: this.reorderTo(rank), moved: false }
      : {
          task: this.moveTo(line, to, rank, newNote, handMove, turnHeads),
          moved: true,
        };
  }

  assignedOnOpening(candidates: OpeningCandidates, members: TeamMembers): Task {
    const first = [candidates.named, candidates.lineDefault].find(
      (each): each is UserId => each !== null && members.includes(each),
    );

    return first ? this.assign(first, members) : this;
  }

  assignedIfMember(userId: UserId, members: TeamMembers): Task {
    return members.includes(userId) ? this.assign(userId, members) : this;
  }

  assign(userId: UserId, members: TeamMembers): Task {
    if (!members.includes(userId)) {
      throw new NotATeamMemberError();
    }

    return this.assignedTo(userId);
  }

  unassign(): Task {
    return this.assignedTo(null);
  }

  answerAs(
    answerer: UserId,
    members: TeamMembers,
    from: NotePosition,
    newNote: NewNote,
    decision: ApprovalDecision | null = null,
    edits: ApprovalEdits | null = null,
  ): Task {
    return (
      this.answersItsOwnAsk(from, Voice.person(answerer))
        ? this
        : this.heldBy(answerer, members)
    ).answer(from, newNote, decision, edits);
  }

  resolveAs(
    resolver: UserId,
    members: TeamMembers,
    from: NotePosition,
    newNote: NewNote,
  ): Task {
    return this.heldBy(resolver, members).resolveAt(from, newNote);
  }

  private heldBy(person: UserId, members: TeamMembers): Task {
    if (!this.assignee && !members.includes(person)) {
      throw new NotOnTheTeamAskedError(this.id.value);
    }

    if (!this.assignee) {
      return this.assign(person, members);
    }

    if (!this.assignee.equals(person)) {
      throw new AssignedToAnotherPersonError(this.id.value);
    }

    return this;
  }

  private claimedOnAnswer(person: UserId | null, members: TeamMembers): Task {
    return person && this.assignee === null
      ? this.assignedIfMember(person, members)
      : this;
  }

  private assignedTo(assignee: UserId | null): Task {
    const hold = this.openHold;

    if (hold && !(assignee?.equals(hold.by) ?? false)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is on hold. It stays assigned to the person who holds it until the line resumes.`,
      );
    }

    const unchanged = assignee
      ? (this.assignee?.equals(assignee) ?? false)
      : this.assignee === null;

    if (unchanged) {
      return this;
    }

    const assigned = this.with({ assignee });
    assigned.record(new TaskAssigned(this.id, this.workspaceId, assignee));

    return assigned;
  }

  recordPullRequest(
    by: RunId,
    url: PullRequestUrl,
    at: Date,
    line: LineMap,
  ): Task {
    this.assertNoOtherRun(by, 'open a pull request for it');

    if (this.reviewing) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} reviews a pull request. It cannot open one.`,
      );
    }

    if (
      url.repository
        ? this.pullRequestIn(url.repository)
        : this.pullRequests.some((each) => each.equals(url))
    ) {
      return this;
    }

    const opened = this.markedBy(Mark.pullRequest(url), at).with({
      ownedPullRequests: [
        ...this.ownedPullRequests,
        OwnedPullRequest.of(url, at),
      ],
    });
    opened.record(
      new PullRequestOpened(
        opened.id,
        opened.workspaceId,
        line.teamId,
        url,
        at,
      ),
    );

    return opened;
  }

  reviews(
    url: PullRequestUrl,
    by: { outside: boolean },
    line: LineMap,
    at: Date,
  ): Task {
    if (this.ownedPullRequests.length > 0 || this.reviewedPullRequest) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has its own pull request. It cannot review another.`,
      );
    }

    if (!line.stationAt(this.stationId)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is not on line ${line.key.value}.`,
      );
    }

    const reviewed = ReviewedPullRequest.of(url, by);

    if (!reviewed.reviewedHead) {
      throw new UnreviewablePullRequestError(url.value);
    }

    const reviewing = this.markedBy(Mark.review(url), at).with({
      reviewedPullRequest: reviewed,
    });
    reviewing.record(
      new PullRequestReviewTaken(
        reviewing.id,
        reviewing.workspaceId,
        line.teamId,
        url,
      ),
    );

    return reviewing;
  }

  get pullRequests(): readonly PullRequestUrl[] {
    return this.ownedPullRequests.map((each) => each.url);
  }

  get openPullRequests(): readonly PullRequestUrl[] {
    return this.ownedPullRequests
      .filter((each) => each.open)
      .map((each) => each.url);
  }

  private hasPullRequest(url: PullRequestUrl): boolean {
    return (
      (this.reviewedPullRequest?.url.equals(url) ?? false) ||
      this.pullRequests.some((each) => each.equals(url))
    );
  }

  routedCloseOf(url: PullRequestUrl): boolean {
    return (
      this.ownedPullRequests.find((each) => each.url.equals(url))
        ?.closeRouted ?? false
    );
  }

  keepsUnsettledPullRequestBeside(closed: PullRequestUrl): boolean {
    return this.ownedPullRequests.some(
      (each) => !each.settled && !each.url.equals(closed),
    );
  }

  private get pullRequestsSettled(): boolean {
    return this.ownedPullRequests.every((each) => each.settled);
  }

  holdMoveUntilPullRequestsClose(
    to: StationId,
    closed: PullRequestUrl,
    newNote: NewNote,
  ): Task {
    if (!this.keepsUnsettledPullRequestBeside(closed)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has no other open pull request. Nothing holds its move.`,
      );
    }

    this.assertNotAtStation(to);

    return this.addMessage(newNote)
      .routedClose(closed)
      .with({ moveHeldTo: to });
  }

  pullRequestClosed(
    url: PullRequestUrl,
    at: Date,
    heldMoveOn: HeldMoveOn,
  ): Task {
    const owned = this.ownedPullRequests.find((each) => each.url.equals(url));

    if (!owned?.open) {
      return this;
    }

    const closed = this.withOwned(owned.closed(at));
    closed.record(new TaskPullRequestClosed(this.id, this.workspaceId, url));

    return closed.pullRequestsSettled
      ? closed.releasedHeldMove(url, { ...heldMoveOn, at })
      : closed;
  }

  private releasedHeldMove(
    by: PullRequestUrl,
    on: HeldMoveOn & { readonly at: Date },
  ): Task {
    const to = this.moveHeldTo;

    if (!to) {
      return this;
    }

    const released = this.with({ moveHeldTo: null });
    const destination = on.line?.stationAt(to);

    if (!on.line || !destination || destination.id.equals(this.stationId)) {
      return released;
    }

    const outcome = ReactionFor.movingTo(
      released,
      destination,
      {
        line: on.line,
        body: TaskNoteBody.movedWhenPullRequestsClosed(destination.name),
        anchor: null,
      },
      by,
    );

    return (
      released.reactTo(outcome, {
        at: on.at,
        voice: Voice.world(),
        attachments: [],
        ranksAtDestination: on.ranksAtHeldMove,
        members: TeamMembers.of([]),
      }) ?? released
    );
  }

  private routedClose(url: PullRequestUrl | null): Task {
    const owned =
      url && this.ownedPullRequests.find((each) => each.url.equals(url));

    return owned
      ? this.withOwned(owned.routedClose()).with({ moveHeldTo: null })
      : this;
  }

  private movedOnClose(url: PullRequestUrl | null): Task {
    if (!url) {
      return this;
    }

    return this.with({
      ownedPullRequests: this.ownedPullRequests.map((each) =>
        each.url.equals(url) || !each.open ? each.routedClose() : each,
      ),
      moveHeldTo: null,
    });
  }

  pullRequestReopened(url: PullRequestUrl): Task {
    const owned = this.ownedPullRequests.find((each) => each.url.equals(url));
    const changed = owned?.reopened();

    if (!changed || changed === owned) {
      return this;
    }

    const reopened = this.withOwned(changed).with({
      moveHeldTo: null,
    });
    reopened.record(
      new TaskPullRequestReopened(this.id, this.workspaceId, url),
    );

    return reopened;
  }

  private withOwned(changed: OwnedPullRequest): Task {
    return this.with({
      ownedPullRequests: this.ownedPullRequests.map((each) =>
        each.url.equals(changed.url) ? changed : each,
      ),
    });
  }

  pullRequestIn(repository: Repository): PullRequestUrl | null {
    return (
      this.pullRequests.find(
        (each) => each.repository?.equals(repository) ?? false,
      ) ?? null
    );
  }

  pullRequestStep(repository: Repository): PullRequestStep {
    if (this.reviewing) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} reviews a pull request. It cannot open or edit one.`,
      );
    }

    const pullRequest = this.pullRequestIn(repository);

    return pullRequest ? { kind: 'edit', pullRequest } : { kind: 'open' };
  }

  get reviewing(): boolean {
    return this.reviewedPullRequest !== null;
  }

  get fromOutside(): boolean {
    return this.reviewedPullRequest?.fromOutside ?? false;
  }

  get reviewedHead(): ReviewedHead | null {
    return this.reviewedPullRequest?.reviewedHead ?? null;
  }

  sendDraft(generation: DraftGeneration | null): Task {
    if (generation === null) {
      return this;
    }

    if (!generation.equals(this.draftGeneration)) {
      throw new DraftAlreadySentError(this.id.value);
    }

    const sent = this.with({ draftGeneration: generation.next() });

    sent.record(new TaskDraftSent(this.id, this.workspaceId, generation));

    return sent;
  }

  get marks(): readonly Mark[] {
    return this.heldMarks.map((each) => each.mark);
  }

  marksWithProposal(chatMarks: readonly Mark[]): readonly Mark[] {
    return this.proposedIn ? [...chatMarks, ...this.marks] : this.marks;
  }

  holdsMark(mark: Mark): HeldMark | null {
    return this.heldMarks.find((each) => each.is(mark)) ?? null;
  }

  markedBy(mark: Mark, at: Date): Task {
    if (this.holdsMark(mark)) {
      return this;
    }

    const marked = this.with({
      marks: [...this.heldMarks, HeldMark.of(mark, at)],
    });
    marked.record(new TaskMarked(this.id, this.workspaceId, mark));

    return marked;
  }

  releaseMark(mark: Mark): Task {
    if (!this.holdsMark(mark)) {
      return this;
    }

    const released = this.with({
      marks: this.heldMarks.filter((each) => !each.is(mark)),
    });

    released.record(new TaskMarkReleased(this.id, this.workspaceId, mark));

    return released;
  }

  get running(): boolean {
    return this.currentRunId !== null;
  }

  hasCurrentRun(runId: RunId): boolean {
    return this.currentRunId?.equals(runId) ?? false;
  }

  get awaitingReview(): boolean {
    return this.trail.awaitsAPerson;
  }

  get working(): boolean {
    return worksOn(this.running, this.trail.notes);
  }

  takesUp(runId: RunId): boolean {
    return takesUpRun({
      holdsRun: this.hasCurrentRun(runId),
      awaitsAPerson: this.awaitingReview,
    });
  }

  get idle(): boolean {
    return !this.running && !this.awaitingReview && !this.finished;
  }

  get finished(): boolean {
    return this.finishedAt !== null;
  }

  get reopensOnMention(): boolean {
    return this.finished;
  }

  get workingCopyRelease(): WorkingCopyRelease {
    return this.finishedAt
      ? WorkingCopyRelease.since(this.finishedAt)
      : WorkingCopyRelease.held();
  }

  get isSetup(): boolean {
    return this.notes.some((note) => note.form === 'setup');
  }

  get setupOpen(): boolean {
    return openSetupList(this.notes) !== null;
  }

  get hasUnreadAsk(): boolean {
    return anyUnread(this.notes);
  }

  addMessage(newNote: NewNote, at: StationId | null = null): Task {
    if (at && !this.stationId.equals(at)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has moved on from that station.`,
      );
    }

    return this.holdsAside(newNote.voice)
      ? this.heldAside(newNote)
      : this.noted(newNote, 'message');
  }

  holdsOnMessage(
    by: RunId,
    voice: Voice,
    at: StationId | null,
    line: LineMap,
  ): boolean {
    return (
      voice.isPerson &&
      voice.author !== null &&
      !this.onHold &&
      !this.finished &&
      at !== null &&
      this.stationId.equals(at) &&
      Boolean(line.stationAt(this.stationId)?.harness) &&
      this.pendingAnswerTo(by, at) === null
    );
  }

  private pendingAnswerTo(
    by: RunId,
    at: StationId | null,
  ): Conversation | null {
    const answering =
      this.hasCurrentRun(by) ||
      (!this.running && at !== null && this.stationId.equals(at));

    return answering && !this.decisionPending ? this.pendingConversation : null;
  }

  receiveMessage(
    by: RunId,
    newNote: NewNote,
    at: StationId | null,
    members: TeamMembers,
  ): Task {
    const pending = this.pendingAnswerTo(by, at);
    const sender = newNote.voice.isPerson ? newNote.voice.author : null;

    if (pending && !this.holdsAside(newNote.voice)) {
      return sender
        ? this.answerAs(sender, members, pending.from, newNote)
        : this.answer(pending.from, newNote);
    }

    const withMessage = this.addMessage(newNote, at);

    if (sender && !this.running && !this.onHold) {
      withMessage.record(
        new TaskActedOn(
          this.id,
          this.workspaceId,
          this.stationId,
          'sent-back',
          sender,
          by,
          newNote.at,
        ),
      );
    }

    return withMessage;
  }

  reopenableOn(line: LineMap): boolean {
    return this.finished && !line.completed.id.equals(this.stationId);
  }

  keepsNoLiveWorkingCopyOn(line: LineMap | null): boolean {
    return this.finished && (line === null || !this.reopenableOn(line));
  }

  reopensAt(line: LineMap, happening: Happening): StationId {
    const rule = line.reactionTo(happening, this.stationId);

    return (rule && line.stationAt(rule.to)?.id) ?? this.stationId;
  }

  reopen(
    line: LineMap,
    happening: Happening,
    rank: TaskRank,
    newNote: NewNote,
  ): Task {
    const to = this.reopensAt(line, happening);

    if (!this.reopenableOn(line)) {
      throw new TaskNotReopenableError(this.id.value);
    }

    const sender = newNote.voice.isPerson ? newNote.voice.author : null;

    if (!sender) {
      throw new ReopenedByNobodyError(this.id.value);
    }

    if (!newNote.anchor) {
      throw new NothingSaidError(this.id.value);
    }

    const said = { ...newNote, line };
    const reopened = this.stationId.equals(to)
      ? this.addMessage(said)
      : this.react(line, to, rank, said);

    reopened.record(
      new TaskActedOn(
        this.id,
        this.workspaceId,
        this.stationId,
        'sent-back',
        sender,
        this.lastRun,
        newNote.at,
      ),
    );

    return reopened;
  }

  reactTo(
    outcome: Outcome,
    on: {
      readonly at: Date;
      readonly voice: Voice;
      readonly attachments: readonly Attachment[];
      readonly ranksAtDestination: readonly TaskRank[];
      readonly members: TeamMembers;
    },
  ): Task | null {
    if (outcome.kind === 'nothing') {
      return null;
    }

    const newNote: NewNote = {
      line: outcome.line,
      body: outcome.body,
      at: on.at,
      voice: on.voice,
      anchor: outcome.anchor,
      attachments: on.attachments,
    };

    switch (outcome.kind) {
      case 'stays':
        return this.addMessage(newNote);
      case 'held':
        return this.holdMoveUntilPullRequestsClose(
          outcome.to.id,
          outcome.closed,
          newNote,
        );
      case 'deferredMove':
        return this.deferMove(
          outcome.line,
          outcome.to.id,
          newNote,
        ).movedOnClose(outcome.closed);
      case 'answers':
        if (this.holdsAside(on.voice)) {
          return this.addMessage(newNote);
        }

        return this.answer(outcome.to, newNote).claimedOnAnswer(
          on.voice.author,
          on.members,
        );
      case 'moves':
        return this.react(
          outcome.line,
          outcome.to.id,
          Placement.entering('reacted', on.ranksAtDestination),
          newNote,
        ).movedOnClose(outcome.closed);
    }
  }

  get decisionPending(): boolean {
    return Boolean(this.pendingAsk?.approval);
  }

  private get pendingAsk(): TaskNote | null {
    if (!this.awaitingReview) {
      return null;
    }

    return (
      [...this.notes].reverse().find((note) => note.kind === 'asked') ?? null
    );
  }

  closeConversation(newNote: NewNote): Task {
    if (!this.trail.open) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has no open conversation to close.`,
      );
    }

    return this.noted(newNote, 'passed');
  }

  resolveAt(from: NotePosition, newNote: NewNote): Task {
    this.assertDrivenBy(newNote.voice, 'resolve it');

    if (!this.isWaitingAt(from)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is not waiting on anyone at that note.`,
      );
    }

    return this.stopped(newNote.at)
      .closeConversation({ ...newNote, form: 'resolved' })
      .acknowledgeNotesAt(newNote.at);
  }

  reopenAt(from: NotePosition, newNote: NewNote): Task {
    this.assertDrivenBy(newNote.voice, 'reopen it');

    const last = this.trail.lastClosed;
    const closing = last?.to ? last.to.noteIn(this.notes) : undefined;

    if (
      !reopenable(
        from,
        last,
        closing
          ? { form: closing.form, byAPerson: closing.voice.isPerson }
          : null,
      )
    ) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has no conversation resolved by a person at that note.`,
      );
    }

    const reopened = this.with(this.appendNote(newNote, 'reopened'));
    reopened.record(
      new TaskConversationReopened(this.id, this.workspaceId, newNote.at),
    );

    return reopened;
  }

  passedOn(
    by: RunId,
    line: LineMap,
    to: StationId,
    rank: TaskRank,
    newNote: NewNote,
  ): Task {
    this.assertNoOtherRun(by, 'pass it on');

    const into = Task.stationOn(line, to);

    if (line.passDenial(this.stationId, into) !== null) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} cannot pass to station ${into.name.value}.`,
      );
    }

    const passed = this.relocated(line, into.id, rank, newNote, null);

    passed.record(
      new TaskPassed(
        this.id,
        this.workspaceId,
        by,
        this.stationId,
        into.id,
        newNote.at,
      ),
    );

    return passed;
  }

  finishHere(by: RunId, line: LineMap, newNote: NewNote): Task {
    this.assertNotOnHold('finish it here');
    this.assertNoOtherRun(by, 'finish it');

    if (!line.endsAt(this.stationId)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is not at the end of its line. It cannot finish here.`,
      );
    }

    const finished = this.with({
      currentRunId: null,
      ...this.appendNote(newNote, 'passed'),
      finishedAt: newNote.at,
      revision: this.revision.next(),
    }).acknowledgeNotesAt(newNote.at);

    finished.record(
      new TaskFinished(
        finished.id,
        finished.workspaceId,
        finished.stationId,
        newNote.at,
      ),
    );

    return finished;
  }

  assignRun(runId: RunId, line: LineMap): Task {
    if (this.currentRunId) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} already has a run in progress.`,
      );
    }

    if (!this.wantsRun(line)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is waiting on a person, finished or at a station where nothing runs.`,
      );
    }

    const hold = this.openHold;
    const assigned = this.with({
      currentRunId: runId,
      ...(hold ? { holds: this.replacedHold(hold.withTurn(runId)) } : {}),
    });

    assigned.record(new TaskRunAssigned(this.id, this.workspaceId, runId));

    return assigned;
  }

  wantsRun(line: LineMap): boolean {
    const hold = this.openHold;

    return (
      this.idle &&
      Boolean(line.stationAt(this.stationId)?.harness) &&
      (hold === null || this.hasMessageFrom(hold.by))
    );
  }

  get openHold(): Hold | null {
    return this.holds.find((each) => each.open) ?? null;
  }

  get onHold(): boolean {
    return this.openHold !== null;
  }

  drivenByAPerson(runId: RunId): boolean {
    return this.holds.some((each) => each.drives(runId));
  }

  driverOf(runId: RunId): RunDriver {
    return this.drivenByAPerson(runId) ? 'person' : 'line';
  }

  hold(input: {
    id: HoldId;
    by: UserId;
    members: TeamMembers;
    line: LineMap;
    currentRunStarted: boolean;
    at: Date;
  }): Task {
    const open = this.openHold;

    if (open) {
      throw new TaskOnHoldError(this.id, open.by);
    }

    if (this.finished) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has finished. It cannot be put on hold.`,
      );
    }

    const station = Task.stationOn(input.line, this.stationId);

    if (!station.harness) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is at ${station.name.value}, where no agent works. It cannot be put on hold there.`,
      );
    }

    const started = Hold.start({
      id: input.id,
      by: input.by,
      stationId: this.stationId,
      from: this.lastLineRun(input.currentRunStarted),
      at: input.at,
    });
    const held = this.deferredMoveTo;
    const onHold = this.assign(input.by, input.members)
      .stopped(input.at)
      .noted(
        {
          line: input.line,
          body: TaskNoteBody.putOnHold(
            station.name,
            input.line.resumeOptionsAt(this.stationId),
          ),
          at: input.at,
          voice: Voice.person(input.by),
          form: 'held',
        },
        'passed',
      )
      .with({
        holds: [...this.holds, held ? started.holdingMoveTo(held) : started],
      });

    onHold.record(
      new TaskHeld(
        this.id,
        this.workspaceId,
        input.line.teamId,
        started.id,
        this.stationId,
        input.by,
        started.from,
        input.at,
      ),
    );

    return onHold;
  }

  resumeLine(input: {
    by: UserId;
    line: LineMap;
    next: HoldEnd;
    to: StationId | null;
    rank: TaskRank | null;
    verdict: HoldVerdict | null;
    summary: string | null;
    turnHeads: readonly TurnHeads[];
    at: Date;
    run?: RunId | null;
  }): Task {
    const hold = this.openHold;

    if (!hold) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is not on hold. There is nothing to resume.`,
      );
    }

    if (!hold.by.equals(input.by)) {
      throw new TaskOnHoldError(this.id, hold.by);
    }

    if (this.working) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has a turn in progress. Wait for it to end, or stop it, before you resume the line.`,
      );
    }

    const into = this.resumeDestination(input.line, input.next, input.to);
    const ending = this.endedHold({
      hold,
      line: input.line,
      next: input.next,
      into,
      summary: input.summary,
      verdict: input.verdict,
      turnHeads: input.turnHeads,
      voice: input.run ? Voice.station(input.run) : Voice.person(input.by),
      at: input.at,
    });
    const resumed = into
      ? ending.closed.relocated(
          input.line,
          into.id,
          this.rankFor(input.rank),
          ending.newNote,
          null,
        )
      : ending.closed
          .withHeldNotesFor(hold)
          .continuedAfter(input.line, ending.newNote, ending.held);

    return this.recordedResume(resumed, ending.ended, input.next, input.line);
  }

  private endedHold(input: {
    hold: Hold;
    line: LineMap;
    next: HoldEnd;
    into: Station | null;
    summary: string | null;
    verdict: HoldVerdict | null;
    turnHeads: readonly TurnHeads[];
    voice: Voice;
    at: Date;
  }): { closed: Task; ended: Hold; newNote: NewNote; held: Station | null } {
    const here = Task.stationOn(input.line, this.stationId);
    const held = input.hold.heldMove
      ? (input.line.stationAt(input.hold.heldMove) ?? null)
      : null;
    const ended = input.hold.ended({
      end: input.next,
      verdict: input.verdict ?? input.hold.verdict,
      turnHeads: input.turnHeads,
      at: input.at,
    });
    const summary = input.summary?.trim() || null;
    const newNote: NewNote = {
      line: input.line,
      body: TaskNoteBody.resumed({
        at: here.name,
        into: input.into && {
          name: input.into.name,
          completed: input.into.isCompleted,
        },
        held: held?.name ?? null,
        changes: ended.toHeads.flatMap((to) => {
          const from = ended.fromHeads.find((each) => each.path === to.path);

          return from
            ? [{ path: to.path, from: from.commit, to: to.commit }]
            : [];
        }),
        summary,
      }),
      at: input.at,
      voice: input.voice,
      form: 'resumed',
      resumption: Resumption.to({ here, into: input.into, summary }),
    };
    const closed = this.withHeldNoteAcknowledged(input.at)
      .stopped(input.at)
      .with({ holds: this.replacedHold(ended) });

    return { closed, ended, newNote, held };
  }

  private recordedResume(
    resumed: Task,
    ended: Hold,
    next: HoldEnd,
    line: LineMap,
  ): Task {
    const at = ended.endedAt ?? ended.startedAt;

    if (ended.verdict === 'not-right' && ended.from) {
      resumed.record(
        new TaskActedOn(
          this.id,
          this.workspaceId,
          this.stationId,
          'held',
          ended.by,
          ended.from,
          ended.startedAt,
        ),
      );
    }

    resumed.record(
      new LineResumed(
        this.id,
        this.workspaceId,
        line.teamId,
        ended.id,
        this.stationId,
        ended.by,
        ended.from,
        ended.verdict,
        next,
        ended.turns,
        ended.fromHeads,
        ended.toHeads,
        ended.startedAt,
        at,
      ),
    );

    return resumed;
  }

  resumeDestination(
    line: LineMap,
    next: HoldEnd,
    to: StationId | null,
  ): Station | null {
    if (next === 'continue') {
      const held = this.openHold?.heldMove;

      return held && line.completed.id.equals(held) ? line.completed : null;
    }

    if (next === 'finish') {
      return line.completed;
    }

    if (!to) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} needs a station to move on to.`,
      );
    }

    const into = Task.stationOn(line, to);

    if (line.passDenial(this.stationId, into) !== null) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} cannot move on to station ${into.name.value}.`,
      );
    }

    return into;
  }

  private rankFor(rank: TaskRank | null): TaskRank {
    if (!rank) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} needs a place at the station it moves to.`,
      );
    }

    return rank;
  }

  private continuedAfter(
    line: LineMap,
    newNote: NewNote,
    to: Station | null,
  ): Task {
    const continued = this.noted(newNote, 'passed');

    return to && !to.id.equals(this.stationId)
      ? continued.noted(
          {
            line,
            body: TaskNoteBody.movesAfterHold(to.name),
            at: newNote.at,
            voice: Voice.world(),
          },
          'message',
          DeferredMove.moveTo(to.id),
        )
      : continued;
  }

  private get heldAt(): NotePosition | null {
    return (
      [...this.notes].reverse().find((note) => note.form === 'held')
        ?.position ?? null
    );
  }

  private withHeldNoteAcknowledged(at: Date): Task {
    const putOnHold = this.heldAt;

    return this.with({
      notes: this.notes.map((note) =>
        putOnHold && note.position.equals(putOnHold)
          ? note.acknowledge(at)
          : note,
      ),
    });
  }

  private heldAsideBy(hold: Hold, note: TaskNote): boolean {
    const putOnHold = this.heldAt;

    return (
      putOnHold !== null &&
      note.position.value > putOnHold.value &&
      !note.voice.isStation &&
      !(note.voice.isPerson && (note.voice.author?.equals(hold.by) ?? false))
    );
  }

  private withHeldNotesFor(hold: Hold): Task {
    return this.with({
      notes: this.notes.map((note) =>
        this.heldAsideBy(hold, note) ? note.heldForTheAgent() : note,
      ),
    });
  }

  private asksWhileHeld(person: UserId): boolean {
    return ConversationAudience.asksWhileHeld(
      this.openHold !== null,
      this.openConversationNote,
      person,
    );
  }

  private answersItsOwnAsk(from: NotePosition, voice: Voice): boolean {
    return (
      voice.isPerson &&
      voice.author !== null &&
      this.isWaitingAt(from) &&
      this.asksWhileHeld(voice.author)
    );
  }

  private holdsAside(voice: Voice): boolean {
    const hold = this.openHold;

    return (
      hold !== null &&
      !(voice.isPerson && (voice.author?.equals(hold.by) ?? false))
    );
  }

  private hasMessageFrom(person: UserId): boolean {
    return this.unacknowledged.some(
      (note) =>
        note.form === 'words' &&
        note.voice.isPerson &&
        (note.voice.author?.equals(person) ?? false),
    );
  }

  private lastLineRun(currentRunStarted: boolean): RunId | null {
    const putOnHold = this.notes.filter((note) => note.form === 'held');
    const newest = [...this.notes].reverse();
    const elsewhere = newest.findIndex(
      (note) => !note.stationId.equals(this.stationId),
    );
    const visit = elsewhere === -1 ? newest : newest.slice(0, elsewhere);
    const ranHere = visit.map((note) =>
      note.form === 'held'
        ? (this.holds[putOnHold.indexOf(note)]?.from ?? null)
        : note.voice.run,
    );
    const current = currentRunStarted ? this.currentRunId : null;
    const last = [current, ...ranHere].find(
      (each): each is RunId => each !== null && !this.drivenByAPerson(each),
    );

    return last && !this.labelledByAHold(last) ? last : null;
  }

  private labelledByAHold(runId: RunId): boolean {
    return this.holds.some(
      (each) =>
        !each.open &&
        each.verdict === 'not-right' &&
        (each.from?.equals(runId) ?? false),
    );
  }

  private replacedHold(changed: Hold): readonly Hold[] {
    return this.holds.map((each) => (each.equals(changed) ? changed : each));
  }

  private heldAside(newNote: NewNote): Task {
    const noted = this.noted(newNote, 'message', null);
    const added = NotePosition.lastIn(noted.notes);

    return added
      ? noted.with({
          notes: noted.notes.map((note) =>
            note.position.equals(added) ? note.acknowledge(newNote.at) : note,
          ),
        })
      : noted;
  }

  private assertDrivenBy(voice: Voice, doing: string): void {
    if (this.holdsAside(voice)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is on hold. Only the person who holds it can ${doing} until the line resumes.`,
      );
    }
  }

  private assertNotOnHold(doing: string): void {
    if (this.onHold) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is on hold. Resume the line before you ${doing}.`,
      );
    }
  }

  dropUnstartedRun(runId: RunId): Task {
    return this.hasCurrentRun(runId) ? this.endedRun(runId) : this;
  }

  leaveRun(runId: RunId, at: Date): Task {
    return this.hasCurrentRun(runId)
      ? this.endedRun(runId).acknowledgeNotesAt(at)
      : this;
  }

  private endedRun(runId: RunId): Task {
    const ended = this.with({ currentRunId: null });

    ended.record(new TaskRunEnded(this.id, this.workspaceId, runId));

    return ended;
  }

  private acknowledgeNotesAt(at: Date): Task {
    const last = NotePosition.lastIn(this.notes);

    return last ? this.acknowledgedUpTo(last, at) : this;
  }

  recordSession(
    by: RunId,
    session: HarnessSession,
    claimedBy: RunnerId | null,
  ): Task {
    if (
      !this.hasCurrentRun(by) ||
      (this.session?.equals(session) &&
        (claimedBy === null
          ? this.claimedBy === null
          : (this.claimedBy?.equals(claimedBy) ?? false)))
    ) {
      return this;
    }

    const kept = this.with({ session, claimedBy });

    kept.record(new TaskSessionKept(this.id, this.workspaceId, by));

    return kept;
  }

  resume(): Resume {
    return Resume.of({
      session: this.session,
    });
  }

  private get lastRun(): RunId | null {
    const byRuns = this.notes
      .map((note) => note.voice.run)
      .filter(
        (each): each is RunId => each !== null && !this.drivenByAPerson(each),
      );
    const current =
      this.currentRunId && !this.drivenByAPerson(this.currentRunId)
        ? this.currentRunId
        : null;

    return current ?? byRuns[byRuns.length - 1] ?? null;
  }

  closesAConversationAt(position: NotePosition): boolean {
    return this.trail.closesAConversationAt(position);
  }

  private get trail(): Trail {
    return Trail.of(this.notes);
  }

  get pendingConversation(): Conversation | null {
    return this.trail.pending;
  }

  get openConversation(): Conversation | null {
    return this.trail.open;
  }

  private isWaitingAt(from: NotePosition): boolean {
    return this.openConversation?.from.equals(from) ?? false;
  }

  get openConversationNote(): TaskNote | null {
    const open = this.trail.open;

    return open ? (open.from.noteIn(this.notes) ?? null) : null;
  }

  wroteIn(person: UserId): boolean {
    return this.notes.some(
      (note) =>
        note.voice.isPerson &&
        [note.voice.author, ...note.voice.coAuthors].some((each) =>
          each?.equals(person),
        ),
    );
  }

  conversationStandingOf(
    viewer: ConversationViewer,
  ): ConversationStanding | null {
    return ConversationAudience.standingOf(this.assignee, {
      ...viewer,
      wroteIn: this.wroteIn(viewer.person),
      asked: this.asksWhileHeld(viewer.person),
    });
  }

  assignedToThem(userId: UserId): boolean {
    return this.assignee?.equals(userId) ?? false;
  }

  unreadFrom(from: NotePosition): boolean {
    return anyUnread(this.conversationAt(from));
  }

  read(from: NotePosition, at: Date): Task {
    const read = this.conversationAt(from);
    const notes = this.notes.map((note) =>
      read.some((each) => each.equals(note)) ? note.read(at) : note,
    );

    if (notes.every((note, index) => note === this.notes[index])) {
      return this;
    }

    const seen = this.with({ notes });

    seen.record(new TaskConversationRead(this.id, this.workspaceId, from));

    return seen;
  }

  private conversationAt(from: NotePosition): readonly TaskNote[] {
    const conversation = this.trail.within(from);

    if (!conversation) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has nothing put to a person at that note.`,
      );
    }

    return conversation;
  }

  get openReviewComments(): readonly OpenReviewComment[] {
    return this.notes.flatMap((note) =>
      note.open && note.anchor
        ? [{ at: note.position, anchor: note.anchor }]
        : [],
    );
  }

  briefedOn(line: LineMap): BriefedTask {
    const hold = this.openHold;

    return BriefedTask.of({
      stationId: this.stationId,
      title: this.title.value,
      description: this.description?.value ?? null,
      reviewing: this.reviewedHead?.repository ?? null,
      attachments: this.attachments,
      notes: this.notes
        .filter((note) => !hold || !this.heldAsideBy(hold, note))
        .map((note) => ({
          station: note.station?.value ?? null,
          body: note.toldOn(line).value,
          attachments: note.attachments,
        })),
      openReviewComments: this.openReviewComments.map((each) => ({
        at: each.at,
        place: each.anchor.place,
        body: each.anchor.body,
      })),
    });
  }

  private reviewCommentAt(at: NotePosition): {
    reviewComment: ReviewComment;
    pullRequest: PullRequestUrl | null;
  } {
    const note = at.noteIn(this.notes);
    const reviewComment = note?.open ? note.reviewComment : null;

    if (!reviewComment) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has no review comment to reply to at that note.`,
      );
    }

    return {
      reviewComment,
      pullRequest: note?.reviewCommentPullRequest ?? null,
    };
  }

  reviewCommentToReplyFrom(
    by: RunId,
    stationId: StationId | null,
    at: NotePosition,
  ): ReviewCommentToReply {
    this.assertNoOtherRun(by, 'reply to a review comment on it');

    const commented = this.reviewCommentAt(at);
    const pullRequest =
      commented.pullRequest ?? this.reviewedPullRequest?.url ?? null;
    const repository = pullRequest?.repository ?? null;

    if (!pullRequest || !repository || !this.hasPullRequest(pullRequest)) {
      throw new NoRepositoryError();
    }

    if (!stationId || !this.stationId.equals(stationId)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has moved on from that station.`,
      );
    }

    return {
      pullRequest,
      repository,
      reviewComment: commented.reviewComment,
    };
  }

  recordReviewCommentReply(
    by: RunId,
    from: StationId | null,
    at: NotePosition,
    newNote: NewNote,
  ): Task {
    this.reviewCommentToReplyFrom(by, from, at);

    const replied = this.noted(newNote, 'message');

    return replied.with({
      notes: replied.notes.map((note) =>
        note.position.equals(at) ? note.answered(newNote.at) : note,
      ),
    });
  }

  get unacknowledged(): readonly TaskNote[] {
    return this.trail.unacknowledged;
  }

  pendingFor(runId: RunId): readonly TaskNote[] {
    return this.hasCurrentRun(runId) ? this.unacknowledged : [];
  }

  get allAttachments(): readonly Attachment[] {
    return [
      ...this.attachments,
      ...this.notes.flatMap((note) => note.attachments),
    ];
  }

  acknowledgeUpTo(by: RunId, position: NotePosition, at: Date): Task {
    return this.hasCurrentRun(by) ? this.acknowledgedUpTo(position, at) : this;
  }

  private acknowledgedUpTo(position: NotePosition, at: Date): Task {
    const notes = this.notes.map((note) =>
      note.position.isAtOrBefore(position) ? note.acknowledge(at) : note,
    );

    if (notes.every((note, index) => note === this.notes[index])) {
      return this;
    }

    const acknowledged = this.with({ notes });

    acknowledged.record(
      new TaskNotesAcknowledged(this.id, this.workspaceId, position),
    );

    return acknowledged;
  }

  askedAbout(newNote: NewNote, by: RunId | null): Task {
    return this.asked(newNote, by, null);
  }

  putToAPerson(by: RunId, newNote: NewNote): Task {
    return this.asked(newNote, by, by);
  }

  awaitTurn(turn: {
    readonly turn: AwaitedTurn;
    readonly note: NewNote;
    readonly session: HarnessSession | null;
    readonly runner: RunnerId | null;
  }): Task {
    const runId = turn.turn.runId;

    if (this.awaitedTurn?.equals(turn.turn)) {
      return this;
    }

    this.assertNoOtherRun(runId, 'await its turn');

    if (!this.hasCurrentRun(runId)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} does not hold run ${runId.value}. It cannot await its turn.`,
      );
    }

    const recorded = turn.session
      ? this.recordSession(runId, turn.session, turn.runner)
      : this;
    const asked = recorded.awaitingReview
      ? recorded
      : recorded.putToAPerson(runId, turn.note);

    const awaiting = asked.with({
      awaitedTurn: turn.turn,
      answeredTurnAt: null,
    });

    awaiting.record(new TaskTurnAwaited(this.id, this.workspaceId, turn.turn));

    return awaiting;
  }

  get lastPersonNoteAt(): Date | null {
    return (
      [...this.notes].reverse().find((note) => note.voice.isPerson)?.at ?? null
    );
  }

  private asked(
    newNote: NewNote,
    by: RunId | null,
    waiting: RunId | null,
  ): Task {
    this.assertNoOtherRun(by, 'put it to a person');

    if (this.awaitingReview) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is already waiting on a person.`,
      );
    }

    const noted = this.with({
      currentRunId: waiting,
      assignee: this.assignee ?? this.createdBy,
      ...this.appendNote(newNote, 'asked'),
    });

    const asked =
      waiting === null && this.running
        ? noted.acknowledgeNotesAt(newNote.at)
        : noted;

    asked.record(
      new TaskAsked(
        asked.id,
        asked.workspaceId,
        asked.stationId,
        asked.assignee,
        newNote.at,
        by ? this.driverOf(by) : 'line',
      ),
    );

    return asked;
  }

  supersedesHookFailureAt(station: StationId | null): boolean {
    return station === null || this.movedOnFrom(station);
  }

  movedOnFrom(station: StationId | null): boolean {
    return (
      this.finished || (station !== null && !this.stationId.equals(station))
    );
  }

  failed(
    failure: TaskFailure,
    newNote: NewNote,
    by: RunId | null,
    line: LineMap,
    deferredMoveRank: TaskRank | null = null,
  ): Task {
    if (this.finished) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has finished. Its failures are not put to anyone.`,
      );
    }

    if (by) {
      this.assertNoOtherRun(by, 'report a failure of it');
    }

    if (!by && this.onHold) {
      const following = failure.following(this.openFailure?.failure ?? null);

      return this.heldAside({
        ...newNote,
        form: 'failure',
        failure: following,
      });
    }

    const deferredMoveTo = by || !this.running ? null : this.deferredMoveTo;

    if (deferredMoveTo && deferredMoveRank && line.stationAt(deferredMoveTo)) {
      return this.failing(failure, by, newNote.at, line.teamId)
        .relocated(
          line,
          deferredMoveTo,
          deferredMoveRank,
          {
            ...newNote,
            body: TaskNoteBody.movedAsDeferred(
              Task.stationOn(line, deferredMoveTo).name,
              newNote.body,
            ),
            form: 'failure',
            failure,
          },
          null,
        )
        .detachRun(this.currentRunId);
    }

    const free = by ? this : this.stopped(newNote.at);
    const earlier = free.openFailure;

    if (free.awaitingReview && earlier?.failure?.sameAs(failure)) {
      const recurred = failure.following(earlier.failure);

      return free
        .with({
          notes: free.notes.map((note) =>
            note.equals(earlier) ? note.recurred(recurred) : note,
          ),
        })
        .failing(recurred, by, newNote.at, line.teamId);
    }

    const following = failure.following(earlier?.failure ?? null);
    const reported: NewNote = {
      ...newNote,
      form: 'failure',
      failure: following,
    };

    return (
      free.awaitingReview
        ? free.noted(reported, 'message')
        : free.askedAbout(reported, by)
    ).failing(following, by, newNote.at, line.teamId);
  }

  private failing(
    failure: TaskFailure,
    by: RunId | null,
    at: Date,
    team: TeamId,
  ): Task {
    const failing = this.with({});

    failing.record(
      new TaskFailed(
        failing.id,
        failing.workspaceId,
        team,
        failing.stationId,
        failure,
        by,
        at,
        by ? this.driverOf(by) : 'line',
      ),
    );

    return failing;
  }

  private stopped(at: Date): Task {
    return this.running
      ? this.with({ currentRunId: null })
          .acknowledgeNotesAt(at)
          .detachRun(this.currentRunId)
      : this;
  }

  clearFor(
    subject: ApprovalSubject,
    needed: ApprovalNeeded,
    asking: NewNote,
    by: RunId,
    intent: ApprovalIntent | null,
  ): Cleared {
    this.assertNoOtherRun(by, 'use a tool on it');

    const current = this.approvalFor(subject);

    if (current?.approval.dismisses) {
      return {
        task: this,
        check: {
          kind: 'dismissed',
          reason: current.approval.decided?.reason ?? '',
        },
      };
    }

    if (current?.approval.grantedFor(needed.askedOf)) {
      return {
        task: this.claimedApprovalAt(current.at),
        check: {
          kind: 'approved',
          claimed: current.at,
          edited: current.approval.goesAheadWith,
        },
      };
    }

    if (this.awaitingReview) {
      return { task: this, check: { kind: 'pending' } };
    }

    const askedOf = needed.askedOf;

    return {
      task: (askedOf ? this.askingOf(askedOf) : this).putToAPerson(by, {
        ...asking,
        form: 'approval',
        approval: Approval.request(subject, this.stationId, needed, intent),
      }),
      check: { kind: 'pending' },
    };
  }

  private askingOf(person: UserId): Task {
    return this.openHold ? this : this.with({ assignee: person });
  }

  askToConnect(by: RunId, asking: NewNote, ask: ConnectionAsk): AskedToConnect {
    this.assertNoOtherRun(by, 'ask a person to connect');

    if (this.awaitingReview) {
      const open = this.openConversation;
      const waiting = open ? open.from.noteIn(this.notes)?.connectionAsk : null;

      return {
        task: this,
        asked:
          waiting?.answeredBy(ask.teamId, ask.integration, ask.personId) ??
          false,
      };
    }

    return {
      task: this.askingOf(ask.personId).putToAPerson(by, {
        ...asking,
        form: 'connection',
        connectionAsk: ask,
      }),
      asked: true,
    };
  }

  connectionMade(
    teamId: TeamId,
    integration: IntegrationName,
    personId: UserId,
    on: { readonly line: LineMap | null; readonly at: Date },
  ): Task | null {
    const open = this.openConversation;
    const ask = open ? open.from.noteIn(this.notes)?.connectionAsk : null;

    if (!open || !ask?.answeredBy(teamId, integration, personId)) {
      return null;
    }

    const answered = this.answer(open.from, {
      line: on.line,
      body: TaskNoteBody.connected(ask.providedBy),
      at: on.at,
      voice: Voice.person(personId),
    });

    return answered.with({
      notes: answered.notes.map((note) =>
        note.position.equals(open.from) ? note.connectionMet() : note,
      ),
    });
  }

  returnApproval(at: NotePosition): Task {
    const returned = this.withApprovalAt(at, (note) => note.returnApproval());

    returned.record(new TaskApprovalReturned(this.id, this.workspaceId, at));

    return returned;
  }

  approvalFor(subject: ApprovalSubject): CurrentApproval | null {
    for (let at = this.notes.length - 1; at >= 0; at--) {
      const note = this.notes[at];
      const approval = note?.approval;

      if (note && approval?.appliesTo(subject, this.stationId)) {
        return { at: note.position, approval };
      }
    }

    return null;
  }

  changesAt(
    from: NotePosition,
    decision: ApprovalDecision | null,
    edits: ApprovalEdits | null,
  ): ToolCall | null {
    if (!this.isWaitingAt(from) || decision !== 'approved' || !edits) {
      return null;
    }

    return from.noteIn(this.notes)?.approval?.changedBy(edits) ?? null;
  }

  answer(
    from: NotePosition,
    newNote: NewNote,
    decision: ApprovalDecision | null = null,
    edits: ApprovalEdits | null = null,
  ): Task {
    if (!this.answersItsOwnAsk(from, newNote.voice)) {
      this.assertDrivenBy(newNote.voice, 'answer it');
    }

    if (!this.isWaitingAt(from)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is not waiting on anyone at that note.`,
      );
    }

    const by = newNote.voice.author;

    if (decision && !from.noteIn(this.notes)?.approval) {
      throw new InvalidApprovalAnswerError(
        `Task ${this.id.value} has nothing waiting for approval at that note.`,
      );
    }

    if (edits && !decision) {
      throw new InvalidApprovalAnswerError(
        'Edits are accepted only with a decision to run.',
      );
    }

    if (decision && !by) {
      throw new InvalidApprovalAnswerError(
        'Only a person can approve or dismiss a request.',
      );
    }

    const noted = this.noted(
      decision ? { ...newNote, form: 'decision' } : newNote,
      'answered',
    );
    const acknowledged =
      noted.running || noted.onHold
        ? noted
        : noted.acknowledgeNotesAt(newNote.at);
    const answered =
      this.awaitedTurn && !acknowledged.awaitedTurn
        ? acknowledged.with({ answeredTurnAt: newNote.at })
        : acknowledged;

    if (this.currentRunId) {
      answered.record(
        new TaskAnswered(
          this.id,
          this.workspaceId,
          this.currentRunId,
          this.awaitedTurn,
        ),
      );
    }

    if (by && newNote.voice.isPerson && !this.onHold) {
      answered.record(
        new TaskActedOn(
          this.id,
          this.workspaceId,
          this.stationId,
          decision ?? 'answered',
          by,
          this.lastRun,
          newNote.at,
          decision
            ? (from.noteIn(this.notes)?.approval?.subject.tool ?? null)
            : null,
        ),
      );
    }

    return decision && by
      ? answered.withApprovalAt(from, (note) =>
          note.decided(
            decision,
            {
              by,
              at: newNote.at,
              reason: newNote.body.value,
            },
            edits,
          ),
        )
      : answered;
  }

  private claimedApprovalAt(at: NotePosition): Task {
    const claimed = this.withApprovalAt(at, (note) => note.approvalClaimed());

    claimed.record(new TaskApprovalClaimed(this.id, this.workspaceId, at));

    return claimed;
  }

  private withApprovalAt(
    at: NotePosition,
    change: (note: TaskNote) => TaskNote,
  ): Task {
    return this.with({
      notes: this.notes.map((note) =>
        note.position.equals(at) ? change(note) : note,
      ),
    });
  }

  private detachRun(runId: RunId | null): Task {
    if (runId) {
      this.record(new TaskRunDetached(this.id, this.workspaceId, runId));
    }

    return this;
  }

  private assertNoOtherRun(by: RunId | null, doing: string): void {
    const isCurrentRun = by ? this.hasCurrentRun(by) : !this.running;

    if (!isCurrentRun) {
      throw new InvalidTaskTransitionError(
        `Only the run working task ${this.id.value} can ${doing}.`,
      );
    }
  }

  private static stationOn(line: LineMap, stationId: StationId): Station {
    const station = line.stationAt(stationId);

    if (!station) {
      throw new UnknownStationError(stationId.value);
    }

    return station;
  }

  private assertHandMoveAllowed(line: LineMap, to: StationId): void {
    const from = Task.stationOn(line, this.stationId);
    const into = Task.stationOn(line, to);
    const denial = line.moveDenial(from, into);

    if (denial) {
      throw new MoveDeniedError(denial, from.name.value, into.name.value);
    }
  }

  private assertNotAtStation(stationId: StationId): void {
    if (this.stationId.equals(stationId)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is already at station ${stationId.value}.`,
      );
    }
  }

  private noted(
    newNote: NewNote,
    kind: TaskNoteKind,
    deferredMove: DeferredMove | null = null,
  ): Task {
    const noted = this.with(this.appendNote(newNote, kind, deferredMove));
    const added = NotePosition.lastIn(noted.notes);

    if (added) {
      noted.record(new TaskNoted(this.id, this.workspaceId, added, kind));
    }

    return noted;
  }

  private appendNote(
    newNote: NewNote,
    kind: TaskNoteKind,
    deferredMove: DeferredMove | null = null,
  ): { notes: readonly TaskNote[]; finishedAt: Date | null } {
    return {
      notes: [
        ...this.notes,
        TaskNote.of({
          ...newNote,
          station: newNote.line?.stationAt(this.stationId)?.name ?? null,
          stationId: this.stationId,
          kind,
          position: NotePosition.nextIn(this.notes),
          deferredMove,
        }),
      ],
      finishedAt: this.reopenedBy(newNote) ? null : this.finishedAt,
    };
  }

  private reopenedBy(newNote: NewNote): boolean {
    return (
      !newNote.voice.isStation &&
      newNote.line !== null &&
      this.reopenableOn(newNote.line)
    );
  }

  private with(part: {
    stationId?: StationId;
    rank?: TaskRank;
    currentRunId?: RunId | null;
    session?: HarnessSession | null;
    claimedBy?: RunnerId | null;
    notes?: readonly TaskNote[];
    reviewedPullRequest?: ReviewedPullRequest | null;
    marks?: readonly HeldMark[];
    finishedAt?: Date | null;
    assignee?: UserId | null;
    draftGeneration?: DraftGeneration;
    revision?: TaskRevision;
    awaitedTurn?: AwaitedTurn | null;
    answeredTurnAt?: Date | null;
    ownedPullRequests?: readonly OwnedPullRequest[];
    moveHeldTo?: StationId | null;
    holds?: readonly Hold[];
  }): Task {
    const next = new Task(
      this.id,
      this.workspaceId,
      part.stationId ?? this.stationId,
      this.title,
      this.branch,
      this.description,
      part.rank ?? this.rank,
      part.currentRunId !== undefined ? part.currentRunId : this.currentRunId,
      part.session !== undefined ? part.session : this.session,
      part.claimedBy !== undefined ? part.claimedBy : this.claimedBy,
      part.notes ?? this.notes,
      this.createdAt,
      this.originStationId,
      this.createdBy,
      this.openedFrom,
      part.reviewedPullRequest !== undefined
        ? part.reviewedPullRequest
        : this.reviewedPullRequest,
      part.marks ?? this.heldMarks,
      part.finishedAt !== undefined ? part.finishedAt : this.finishedAt,
      part.assignee !== undefined ? part.assignee : this.assignee,
      this.attachments,
      this.proposedIn,
      part.draftGeneration ?? this.draftGeneration,
      part.revision ?? this.revision,
      this.version,
      part.awaitedTurn !== undefined ? part.awaitedTurn : this.awaitedTurn,
      part.answeredTurnAt !== undefined
        ? part.answeredTurnAt
        : this.answeredTurnAt,
      part.ownedPullRequests ?? this.ownedPullRequests,
      part.moveHeldTo !== undefined ? part.moveHeldTo : this.moveHeldTo,
      part.holds ?? this.holds,
    );

    next.inheritEvents(this);

    const awaited = next.awaitedTurn;

    return awaited &&
      !(next.hasCurrentRun(awaited.runId) && next.awaitingReview)
      ? next.with({ awaitedTurn: null })
      : next;
  }

  deleted(): Task {
    const gone = this.with({ currentRunId: null }).detachRun(this.currentRunId);

    gone.record(new TaskDeleted(this.id, this.workspaceId));

    return gone;
  }

  equals(other: Task): boolean {
    return this.id.equals(other.id);
  }
}
