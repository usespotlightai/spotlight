import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Station } from '@work/domain/entities/station.entity';
import {
  TaskNote,
  type TaskNoteForm,
  type TaskNoteKind,
} from '@work/domain/entities/task-note.entity';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { PullRequestReviewTaken } from '@work/domain/events/pull-request-review-taken.event';
import { RunDetached } from '@work/domain/events/run-detached.event';
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskDeleted } from '@work/domain/events/task-deleted.event';
import { TaskDispatched } from '@work/domain/events/task-dispatched.event';
import { TaskFailed } from '@work/domain/events/task-failed.event';
import { TaskFinished } from '@work/domain/events/task-finished.event';
import { TaskMarkReassigned } from '@work/domain/events/task-mark-reassigned.event';
import { TaskMoved } from '@work/domain/events/task-moved.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import { TaskPassed } from '@work/domain/events/task-passed.event';
import { InvalidApprovalAnswerError } from '@work/domain/exceptions/invalid-approval-answer.error';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { MoveDeniedError } from '@work/domain/exceptions/move-denied.error';
import { NoRepositoryError } from '@work/domain/exceptions/no-repository.error';
import { StaleTaskRevisionError } from '@work/domain/exceptions/stale-task-revision.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { UnreviewablePullRequestError } from '@work/domain/exceptions/unreviewable-pull-request.error';
import {
  type Conversation,
  notesIn,
  worksOn,
} from '@work/domain/services/conversations';
import { anyUnread } from '@work/domain/services/unread';
import type { Anchor } from '@work/domain/value-objects/anchor.vo';
import {
  Approval,
  type ApprovalDecision,
  type ApprovalEdits,
} from '@work/domain/value-objects/approval.vo';
import type { ApprovalCheck } from '@work/domain/value-objects/approval-check';
import type { ApprovalIntent } from '@work/domain/value-objects/approval-intent.vo';
import type { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import type { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import type { ConnectionAsk } from '@work/domain/value-objects/connection-ask.vo';
import { DeferredMove } from '@work/domain/value-objects/deferred-move.vo';
import type { Happening } from '@work/domain/value-objects/happening.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import type { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import {
  PullRequestLink,
  type ReviewedHead,
} from '@work/domain/value-objects/pull-request-link.vo';
import type { ResolvedHandover } from '@work/domain/value-objects/resolved-handover.vo';
import { Resume } from '@work/domain/value-objects/resume.vo';
import { ResumeKey } from '@work/domain/value-objects/resume-key.vo';
import type { ReviewComment } from '@work/domain/value-objects/review-comment.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { StationName } from '@work/domain/value-objects/station-name.vo';
import type { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import type { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';
import type { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import type { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import type { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { Trail } from '@work/domain/value-objects/trail.vo';
import type { Voice } from '@work/domain/value-objects/voice.vo';

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
  readonly station: StationName;
  readonly body: TaskNoteBody;
  readonly at: Date;
  readonly voice: Voice;
  readonly anchor?: Anchor | null;
  readonly form?: TaskNoteForm;
  readonly attachments?: readonly Attachment[];
  readonly approval?: Approval | null;
  readonly failure?: TaskFailure | null;
  readonly connectionAsk?: ConnectionAsk | null;
}

export interface CurrentApproval {
  readonly at: NotePosition;
  readonly approval: Approval;
}

export interface AskedToConnect {
  readonly task: Task;
  readonly asked: boolean;
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
    readonly description: TaskDescription | null,
    readonly rank: TaskRank,
    readonly currentRunId: RunId | null,
    readonly sessionId: HarnessSession | null,
    readonly runnerId: RunnerId | null,
    readonly notes: readonly TaskNote[],
    readonly createdAt: Date,
    readonly originStationId: StationId | null,
    readonly createdBy: UserId | null,
    readonly openedFrom: TaskOrigin,
    readonly pullRequestLink: PullRequestLink | null,
    readonly marks: readonly Mark[],
    readonly finishedAt: Date | null,
    readonly assignee: UserId | null,
    readonly attachments: readonly Attachment[],
    readonly revision: TaskRevision = TaskRevision.first(),
    readonly version: number = 0,
  ) {
    super();
  }

  static add(input: {
    line: Line;
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
    const createdBy = input.createdBy ?? null;
    const receivedFrom = input.receivedFrom ?? null;

    const task = new Task(
      TaskId.of(input.newId()),
      input.line.workspaceId,
      station.id,
      input.title,
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

  static rehydrate(input: {
    id: TaskId;
    workspaceId: WorkspaceId;
    stationId: StationId;
    title: TaskTitle;
    description: TaskDescription | null;
    rank: TaskRank;
    currentRunId: RunId | null;
    sessionId: HarnessSession | null;
    runnerId: RunnerId | null;
    notes: readonly TaskNote[];
    createdAt: Date;
    originStationId: StationId | null;
    createdBy: UserId | null;
    openedFrom: TaskOrigin;
    pullRequestLink?: PullRequestLink | null;
    marks?: readonly Mark[];
    finishedAt: Date | null;
    assignee?: UserId | null;
    attachments?: readonly Attachment[];
    revision: TaskRevision;
    version?: number;
  }): Task {
    if (input.finishedAt !== null && input.currentRunId !== null) {
      throw new InconsistentStateError(
        'task',
        'is finished yet still has a current run',
      );
    }

    if (input.notes.some((note, place) => note.position.value !== place)) {
      throw new InconsistentStateError('task', 'has a gap in its trail');
    }

    if (input.pullRequestLink?.reviews && !input.pullRequestLink.reviewedHead) {
      throw new InconsistentStateError(
        'task',
        'reviews a pull request whose head it cannot check out',
      );
    }

    return new Task(
      input.id,
      input.workspaceId,
      input.stationId,
      input.title,
      input.description,
      input.rank,
      input.currentRunId,
      input.sessionId,
      input.runnerId,
      input.notes,
      input.createdAt,
      input.originStationId,
      input.createdBy,
      input.openedFrom,
      input.pullRequestLink ?? null,
      input.marks ?? [],
      input.finishedAt,
      input.assignee ?? null,
      input.attachments ?? [],
      input.revision,
      input.version ?? 0,
    );
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
    line: Line,
    to: StationId,
    rank: TaskRank,
    newNote: NewNote,
    handMove: { mover: UserId },
  ): Task {
    this.assertHandMoveAllowed(line, to);

    const into = Task.stationOn(line, to);
    const moved = this.relocated(line, to, rank, newNote, handMove).detachRun(
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

  react(line: Line, to: StationId, rank: TaskRank, newNote: NewNote): Task {
    if (this.running) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has a run in progress. A happening cannot move it.`,
      );
    }

    return this.relocated(line, to, rank, newNote, null);
  }

  deferMove(line: Line, to: StationId, newNote: NewNote): Task {
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
        `Task ${this.id.value} cannot defer a move to the end of its line. That move interrupts its run.`,
      );
    }

    return this.with(
      this.appendNote(newNote, 'message', DeferredMove.moveTo(to)),
    );
  }

  get deferredMoveTo(): StationId | null {
    for (const note of [...this.notes].reverse()) {
      if (note.deferredMove) {
        return note.deferredMove.to;
      }

      if (
        note.kind === 'passed' ||
        (note.kind === 'asked' && note.approval === null)
      ) {
        return null;
      }
    }

    return null;
  }

  moveAsDeferred(
    by: RunId,
    line: Line,
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
      ? this.failing(failure, by, ending.newNote.at, line)
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

  interrupt(newNote: NewNote): Task {
    if (!this.running) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has no run in progress.`,
      );
    }

    if (this.awaitsAnAnswer) {
      return this.with(
        this.appendNote(newNote, 'message', DeferredMove.cleared()),
      );
    }

    return this.stopped(newNote.at).asked(newNote, null, null, {
      overAnApproval: true,
    });
  }

  private relocated(
    line: Line,
    to: StationId,
    rank: TaskRank,
    newNote: NewNote,
    handMove: { mover: UserId } | null,
  ): Task {
    const from = Task.stationOn(line, this.stationId);
    const into = Task.stationOn(line, to);

    this.assertNotAtStation(into.id);

    const takesOwnership =
      handMove !== null &&
      !this.assignee &&
      from.isBacklog &&
      into.isAgentStation;

    const moved = this.with({
      stationId: into.id,
      rank,
      currentRunId: null,
      sessionId: null,
      runnerId: null,
      ...this.appendNote(newNote, 'passed'),
      finishedAt: into.isCompleted ? newNote.at : null,
      ...(takesOwnership ? { assignee: handMove.mover } : {}),
      revision: this.revision.next(),
    }).acknowledgeNotesAt(newNote.at);

    moved.record(
      new TaskMoved(
        moved.id,
        moved.workspaceId,
        from.key,
        into.key,
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
    return this.with({ rank });
  }

  assign(userId: UserId): Task {
    return this.with({ assignee: userId });
  }

  unassign(): Task {
    return this.with({ assignee: null });
  }

  claimedBy(userId: UserId): Task {
    return this.assignee ? this : this.with({ assignee: userId });
  }

  get branch(): Branch {
    return Branch.for(this.id);
  }

  recordPullRequest(
    by: RunId,
    url: PullRequestUrl,
    at: Date,
    line: Line,
  ): Task {
    this.assertNoOtherRun(by, 'open a pull request for it');

    if (this.pullRequest) {
      return this;
    }

    const opened = this.markedBy(Mark.pullRequest(url)).with({
      pullRequestLink: PullRequestLink.opened(url),
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

  reviews(url: PullRequestUrl, by: { outside: boolean }): Task {
    if (this.pullRequestLink) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has its own pull request. It cannot review another.`,
      );
    }

    const link = PullRequestLink.reviewing(url, by);

    if (!link.reviewedHead) {
      throw new UnreviewablePullRequestError(url.value);
    }

    const reviewing = this.markedBy(Mark.review(url)).with({
      pullRequestLink: link,
    });
    reviewing.record(
      new PullRequestReviewTaken(reviewing.id, reviewing.workspaceId, url),
    );

    return reviewing;
  }

  get pullRequest(): PullRequestUrl | null {
    return this.pullRequestLink?.url ?? null;
  }

  get reviewing(): boolean {
    return this.pullRequestLink?.reviews ?? false;
  }

  get fromOutside(): boolean {
    return this.pullRequestLink?.fromOutside ?? false;
  }

  get reviewedHead(): ReviewedHead | null {
    return this.pullRequestLink?.reviewedHead ?? null;
  }

  markedBy(mark: Mark): Task {
    return this.marks.some((each) => each.equals(mark))
      ? this
      : this.with({ marks: [...this.marks, mark] });
  }

  reassignMark(mark: Mark, newTaskId: TaskId): Task {
    if (
      newTaskId.equals(this.id) ||
      !this.marks.some((each) => each.equals(mark))
    ) {
      return this;
    }

    const marked = this.with({
      marks: this.marks.filter((each) => !each.equals(mark)),
    });
    marked.record(
      new TaskMarkReassigned(this.id, this.workspaceId, mark, newTaskId),
    );

    return marked;
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
    return this.hasCurrentRun(runId) && !this.awaitingReview;
  }

  get idle(): boolean {
    return !this.running && !this.awaitingReview && !this.finished;
  }

  get finished(): boolean {
    return this.finishedAt !== null;
  }

  addMessage(newNote: NewNote, at: StationId | null = null): Task {
    if (at && !this.stationId.equals(at)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has moved on from that station.`,
      );
    }

    return this.with(this.appendNote(newNote, 'message'));
  }

  receiveMessage(by: RunId, newNote: NewNote, at: StationId | null): Task {
    const answering =
      this.hasCurrentRun(by) ||
      (!this.running && at !== null && this.stationId.equals(at));
    const pending = answering ? this.pendingConversation : null;

    if (pending && !this.decisionPending) {
      return this.answer(NotePosition.of(pending.from), newNote);
    }

    const withMessage = this.addMessage(newNote, at);
    const sender = newNote.voice.isPerson ? newNote.voice.author : null;

    if (sender && !this.running) {
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

  get awaitsAnAnswer(): boolean {
    return this.running && this.awaitingReview && !this.decisionPending;
  }

  get decisionPending(): boolean {
    const asked = [...this.notes]
      .reverse()
      .find((note) => note.kind === 'asked');

    return this.awaitingReview && Boolean(asked?.approval);
  }

  closeConversation(newNote: NewNote): Task {
    if (!this.trail.open) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has no open conversation to close.`,
      );
    }

    return this.with(this.appendNote(newNote, 'passed'));
  }

  resolveAt(from: NotePosition, newNote: NewNote): Task {
    if (this.openConversation?.from !== from.value) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is not waiting on anyone at that note.`,
      );
    }

    return this.stopped(newNote.at)
      .closeConversation({ ...newNote, form: 'resolved' })
      .acknowledgeNotesAt(newNote.at);
  }

  reopenAt(from: NotePosition, newNote: NewNote): Task {
    const last = this.trail.lastClosed;
    const closing = last?.to != null ? this.notes[last.to] : undefined;

    if (
      last?.from !== from.value ||
      closing?.form !== 'resolved' ||
      !closing.voice.isPerson
    ) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has no conversation resolved by a person at that note.`,
      );
    }

    return this.with(this.appendNote(newNote, 'reopened'));
  }

  passedOn(
    by: RunId,
    line: Line,
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

  finishHere(by: RunId, line: Line, newNote: NewNote): Task {
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

  assignRun(runId: RunId, line: Line): Task {
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

    const assigned = this.with({ currentRunId: runId });

    assigned.record(new TaskDispatched(this.id, this.workspaceId, runId));

    return assigned;
  }

  wantsRun(line: Line): boolean {
    return this.idle && Boolean(line.stationAt(this.stationId)?.harness);
  }

  dropUnstartedRun(runId: RunId): Task {
    return this.hasCurrentRun(runId) ? this.with({ currentRunId: null }) : this;
  }

  leaveRun(runId: RunId, at: Date): Task {
    return this.hasCurrentRun(runId)
      ? this.with({ currentRunId: null }).acknowledgeNotesAt(at)
      : this;
  }

  private acknowledgeNotesAt(at: Date): Task {
    return this.notes.length === 0
      ? this
      : this.acknowledgeUpTo(NotePosition.of(this.notes.length - 1), at);
  }

  recordSession(sessionId: HarnessSession, runnerId: RunnerId | null): Task {
    return this.with({ sessionId, runnerId });
  }

  resume(): Resume {
    return Resume.of({
      key: ResumeKey.forTask(this.id.value),
      sessionId: this.sessionId,
    });
  }

  private get lastRun(): RunId | null {
    const byRuns = this.notes.filter((note) => note.voice.run !== null);

    return this.currentRunId ?? byRuns[byRuns.length - 1]?.voice.run ?? null;
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

  createdByThem(userId: UserId): boolean {
    return this.createdBy?.equals(userId) ?? false;
  }

  assignedToThem(userId: UserId): boolean {
    return this.assignee?.equals(userId) ?? false;
  }

  unreadFrom(from: NotePosition): boolean {
    return anyUnread(this.conversationAt(from));
  }

  read(from: NotePosition, at: Date): Task {
    const read = this.conversationAt(from);

    return this.with({
      notes: this.notes.map((note) =>
        read.some((each) => each.equals(note)) ? note.read(at) : note,
      ),
    });
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

  get briefed(): BriefedTask {
    return BriefedTask.of({
      stationId: this.stationId,
      title: this.title.value,
      description: this.description?.value ?? null,
      reviewing: this.reviewedHead?.repository ?? null,
      attachments: this.attachments,
      notes: this.notes.map((note) => ({
        station: note.station.value,
        body: note.body.value,
        attachments: note.attachments,
      })),
      openReviewComments: this.openReviewComments.map((each) => ({
        at: each.at,
        place: each.anchor.place,
        body: each.anchor.body,
      })),
    });
  }

  reviewCommentAt(at: NotePosition): ReviewComment {
    const reviewComment = this.notes[at.value]?.open
      ? this.notes[at.value]?.reviewComment
      : null;

    if (!reviewComment) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has no review comment to reply to at that note.`,
      );
    }

    return reviewComment;
  }

  reviewCommentToReplyFrom(
    by: RunId,
    stationId: StationId | null,
    at: NotePosition,
  ): ReviewCommentToReply {
    this.assertNoOtherRun(by, 'reply to a review comment on it');

    const repository = this.pullRequest?.repository ?? null;

    if (!this.pullRequest || !repository) {
      throw new NoRepositoryError();
    }

    if (!stationId || !this.stationId.equals(stationId)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has moved on from that station.`,
      );
    }

    return {
      pullRequest: this.pullRequest,
      repository,
      reviewComment: this.reviewCommentAt(at),
    };
  }

  recordReviewCommentReply(
    by: RunId,
    from: StationId | null,
    at: NotePosition,
    newNote: NewNote,
  ): Task {
    this.reviewCommentToReplyFrom(by, from, at);

    const replied = this.with(this.appendNote(newNote, 'message'));

    return replied.with({
      notes: replied.notes.map((note) =>
        note.position.equals(at) ? note.answered(newNote.at) : note,
      ),
    });
  }

  get unacknowledged(): readonly TaskNote[] {
    return this.trail.unacknowledged;
  }

  get allAttachments(): readonly Attachment[] {
    return [
      ...this.attachments,
      ...this.notes.flatMap((note) => note.attachments),
    ];
  }

  acknowledgeUpTo(position: NotePosition, at: Date): Task {
    return this.with({
      notes: this.notes.map((note) =>
        note.position.isAtOrBefore(position) ? note.acknowledge(at) : note,
      ),
    });
  }

  askedAbout(newNote: NewNote, by: RunId | null): Task {
    return this.asked(newNote, by, null);
  }

  putToAPerson(by: RunId, newNote: NewNote): Task {
    return this.asked(newNote, by, by);
  }

  private asked(
    newNote: NewNote,
    by: RunId | null,
    waiting: RunId | null,
    { overAnApproval } = { overAnApproval: false },
  ): Task {
    this.assertNoOtherRun(by, 'put it to a person');

    if (this.awaitingReview && !(overAnApproval && this.decisionPending)) {
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
      ),
    );

    return asked;
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
    line: Line | null,
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

    const deferredMoveTo = by || !this.running ? null : this.deferredMoveTo;

    if (deferredMoveTo && deferredMoveRank && line?.stationAt(deferredMoveTo)) {
      return this.failing(failure, by, newNote.at, line)
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
        .failing(recurred, by, newNote.at, line);
    }

    const following = failure.following(earlier?.failure ?? null);
    const reported: NewNote = {
      ...newNote,
      form: 'failure',
      failure: following,
    };

    return (
      free.awaitingReview
        ? free.with(free.appendNote(reported, 'message'))
        : free.askedAbout(reported, by)
    ).failing(following, by, newNote.at, line);
  }

  private failing(
    failure: TaskFailure,
    by: RunId | null,
    at: Date,
    line: Line | null,
  ): Task {
    const failing = this.with({});

    if (line) {
      failing.record(
        new TaskFailed(
          failing.id,
          failing.workspaceId,
          line.teamId,
          failing.stationId,
          failure,
          by,
          at,
        ),
      );
    }

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
        task: this.withApprovalAt(current.at, (note) => note.approvalClaimed()),
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
      task: (askedOf ? this.with({ assignee: askedOf }) : this).putToAPerson(
        by,
        {
          ...asking,
          form: 'approval',
          approval: Approval.request(
            subject,
            this.stationId,
            needed.because,
            intent,
            askedOf,
          ),
        },
      ),
      check: { kind: 'pending' },
    };
  }

  askToConnect(by: RunId, asking: NewNote, ask: ConnectionAsk): AskedToConnect {
    this.assertNoOtherRun(by, 'ask a person to connect');

    if (this.awaitingReview) {
      const open = this.openConversation;
      const waiting = open ? this.notes[open.from]?.connectionAsk : null;

      return {
        task: this,
        asked:
          waiting?.answeredBy(ask.teamId, ask.integration, ask.personId) ??
          false,
      };
    }

    return {
      task: this.with({ assignee: ask.personId }).putToAPerson(by, {
        ...asking,
        form: 'connection',
        connectionAsk: ask,
      }),
      asked: true,
    };
  }

  connectionMade(
    teamId: TeamId,
    integration: string,
    personId: UserId,
    newNote: NewNote,
  ): Task | null {
    const open = this.openConversation;
    const asked = open ? this.notes[open.from] : undefined;

    if (
      !open ||
      !asked?.connectionAsk?.answeredBy(teamId, integration, personId) ||
      !newNote.voice.author?.equals(personId)
    ) {
      return null;
    }

    const answered = this.answer(NotePosition.of(open.from), newNote);

    return answered.with({
      notes: answered.notes.map((note) =>
        note.position.value === open.from ? note.connectionMet() : note,
      ),
    });
  }

  returnApproval(at: NotePosition): Task {
    return this.withApprovalAt(at, (note) => note.returnApproval());
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
    if (
      this.openConversation?.from !== from.value ||
      decision !== 'approved' ||
      !edits
    ) {
      return null;
    }

    return this.notes[from.value]?.approval?.changedBy(edits) ?? null;
  }

  answer(
    from: NotePosition,
    newNote: NewNote,
    decision: ApprovalDecision | null = null,
    edits: ApprovalEdits | null = null,
  ): Task {
    if (this.openConversation?.from !== from.value) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is not waiting on anyone at that note.`,
      );
    }

    const by = newNote.voice.author;

    if (decision && !this.notes[from.value]?.approval) {
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

    const noted = this.with(
      this.appendNote(
        decision ? { ...newNote, form: 'approval' } : newNote,
        'answered',
      ),
    );
    const answered = noted.running
      ? noted
      : noted.acknowledgeNotesAt(newNote.at);

    if (this.currentRunId) {
      answered.record(
        new TaskAnswered(this.id, this.workspaceId, this.currentRunId),
      );
    }

    if (by && newNote.voice.isPerson) {
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
            ? (this.notes[from.value]?.approval?.subject.tool ?? null)
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
      this.record(new RunDetached(this.id, this.workspaceId, runId));
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

  private static stationOn(line: Line, stationId: StationId): Station {
    const station = line.stationAt(stationId);

    if (!station) {
      throw new UnknownStationError(stationId.value);
    }

    return station;
  }

  private assertHandMoveAllowed(line: Line, to: StationId): void {
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

  private appendNote(
    newNote: NewNote,
    kind: TaskNoteKind,
    deferredMove: DeferredMove | null = null,
  ): { notes: readonly TaskNote[]; finishedAt?: null } {
    return {
      notes: [
        ...this.notes,
        TaskNote.of({
          ...newNote,
          stationId: this.stationId,
          kind,
          position: NotePosition.of(this.notes.length),
          deferredMove,
        }),
      ],
      ...(newNote.voice.isStation ? {} : { finishedAt: null }),
    };
  }

  private with(part: {
    stationId?: StationId;
    rank?: TaskRank;
    currentRunId?: RunId | null;
    sessionId?: HarnessSession | null;
    runnerId?: RunnerId | null;
    notes?: readonly TaskNote[];
    pullRequestLink?: PullRequestLink | null;
    marks?: readonly Mark[];
    finishedAt?: Date | null;
    assignee?: UserId | null;
    revision?: TaskRevision;
  }): Task {
    const next = new Task(
      this.id,
      this.workspaceId,
      part.stationId ?? this.stationId,
      this.title,
      this.description,
      part.rank ?? this.rank,
      part.currentRunId !== undefined ? part.currentRunId : this.currentRunId,
      part.sessionId !== undefined ? part.sessionId : this.sessionId,
      part.runnerId !== undefined ? part.runnerId : this.runnerId,
      part.notes ?? this.notes,
      this.createdAt,
      this.originStationId,
      this.createdBy,
      this.openedFrom,
      part.pullRequestLink !== undefined
        ? part.pullRequestLink
        : this.pullRequestLink,
      part.marks ?? this.marks,
      part.finishedAt !== undefined ? part.finishedAt : this.finishedAt,
      part.assignee !== undefined ? part.assignee : this.assignee,
      this.attachments,
      part.revision ?? this.revision,
      this.version,
    );

    next.inheritEvents(this);

    return next;
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
