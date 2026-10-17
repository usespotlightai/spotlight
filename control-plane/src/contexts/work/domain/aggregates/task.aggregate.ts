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
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskDeleted } from '@work/domain/events/task-deleted.event';
import { TaskFailed } from '@work/domain/events/task-failed.event';
import { TaskFinished } from '@work/domain/events/task-finished.event';
import { TaskHandedOn } from '@work/domain/events/task-handed-on.event';
import { TaskHandedToRun } from '@work/domain/events/task-handed-to-run.event';
import { TaskLetGoOfRun } from '@work/domain/events/task-let-go-of-run.event';
import { TaskMarkTaken } from '@work/domain/events/task-mark-taken.event';
import { TaskMoved } from '@work/domain/events/task-moved.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import { InvalidApprovalAnswerError } from '@work/domain/exceptions/invalid-approval-answer.error';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { MoveRefusedError } from '@work/domain/exceptions/move-refused.error';
import { NoRepositoryError } from '@work/domain/exceptions/no-repository.error';
import { StaleTaskRevisionError } from '@work/domain/exceptions/stale-task-revision.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { UnreviewablePullRequestError } from '@work/domain/exceptions/unreviewable-pull-request.error';
import {
  type Conversation,
  notesIn,
} from '@work/domain/services/conversations';
import { anyUnread } from '@work/domain/services/unread';
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
import { Continuity } from '@work/domain/value-objects/continuity.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { DeferredMove } from '@work/domain/value-objects/deferred-move.vo';
import type { Handover } from '@work/domain/value-objects/handover.vo';
import type { Happening } from '@work/domain/value-objects/happening.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import type { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import {
  PullRequestLink,
  type ReviewedHead,
} from '@work/domain/value-objects/pull-request-link.vo';
import type { Remark } from '@work/domain/value-objects/remark.vo';
import type { Said } from '@work/domain/value-objects/said.vo';
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

export interface OpenRemark {
  readonly at: NotePosition;
  readonly said: Said;
}

export interface AnswerableRemark {
  readonly pullRequest: PullRequestUrl;
  readonly repository: Repository;
  readonly remark: Remark;
}

export interface Saying {
  readonly station: StationName;
  readonly body: TaskNoteBody;
  readonly at: Date;
  readonly voice: Voice;
  readonly said?: Said | null;
  readonly form?: TaskNoteForm;
  readonly attachments?: readonly Attachment[];
  readonly approval?: Approval | null;
  readonly failure?: TaskFailure | null;
  readonly connectionAsk?: ConnectionAsk | null;
}

export interface StandingApproval {
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
    readonly raisedAt: StationId | null,
    readonly raisedBy: UserId | null,
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
    raisedBy?: UserId | null;
    heardFrom?: Happening | null;
    proposedIn?: ProposalOrigin | null;
    now: Date;
    newId: () => string;
  }): Task {
    const station = Task.stationOn(input.line, input.at);
    const raisedBy = input.raisedBy ?? null;
    const heardFrom = input.heardFrom ?? null;

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
      raisedBy,
      heardFrom ? TaskOrigin.heardFrom(heardFrom) : TaskOrigin.person(),
      null,
      [],
      null,
      raisedBy,
      input.attachments ?? [],
    );

    task.record(
      new TaskOpened(
        task.id,
        task.workspaceId,
        input.line.teamId,
        input.line.id,
        task.stationId,
        raisedBy,
        input.now,
        heardFrom !== null,
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
    raisedAt: StationId | null;
    raisedBy: UserId | null;
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
      input.raisedAt,
      input.raisedBy,
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

  standsAt(revision: TaskRevision): boolean {
    return this.revision.equals(revision);
  }

  moveTo(
    line: Line,
    to: StationId,
    rank: TaskRank,
    saying: Saying,
    handMove: { mover: UserId },
  ): Task {
    this.refuseHandMove(line, to);

    const into = Task.stationOn(line, to);
    const moved = this.relocated(line, to, rank, saying, handMove).lettingGoOf(
      this.currentRunId,
    );

    moved.record(
      new TaskActedOn(
        this.id,
        this.workspaceId,
        this.stationId,
        into.isCompleted ? 'closed' : into.isBacklog ? 'parked' : 'started',
        handMove.mover,
        this.lastRun,
        saying.at,
      ),
    );

    return moved;
  }

  react(line: Line, to: StationId, rank: TaskRank, saying: Saying): Task {
    if (this.running) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is being worked by a run. A happening cannot move it.`,
      );
    }

    return this.relocated(line, to, rank, saying, null);
  }

  deferMove(line: Line, to: StationId, saying: Saying): Task {
    if (!this.running) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is not being worked by a run. There is no move to defer.`,
      );
    }

    if (this.stationId.equals(to)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} already stands at that station.`,
      );
    }

    if (line.completed.id.equals(to)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} cannot defer a move to the end of its line. That move interrupts its run.`,
      );
    }

    return this.with(this.spoke(saying, 'said', DeferredMove.moveTo(to)));
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
    ending: { saying: Saying; handover: Handover },
  ): Task {
    this.refuseAnotherRun(by, 'make its deferred move');

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
      ? this.failing(failure, by, ending.saying.at, line)
      : this;

    const moved = failing.relocated(
      line,
      to,
      rank,
      {
        ...ending.saying,
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
      new TaskHandedOn(
        this.id,
        this.workspaceId,
        by,
        this.stationId,
        to,
        ending.saying.at,
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

  interrupt(saying: Saying): Task {
    if (!this.running) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is not being worked by a run.`,
      );
    }

    if (this.awaitsAnAnswer) {
      return this.with(this.spoke(saying, 'said', DeferredMove.cleared()));
    }

    return this.stopped(saying.at).asked(saying, null, null, {
      overAnApproval: true,
    });
  }

  private relocated(
    line: Line,
    to: StationId,
    rank: TaskRank,
    saying: Saying,
    handMove: { mover: UserId } | null,
  ): Task {
    const from = Task.stationOn(line, this.stationId);
    const into = Task.stationOn(line, to);

    this.refuseStandingStill(into.id);

    const takesOwnership =
      handMove !== null && !this.assignee && from.isBacklog && into.isWorked;

    const moved = this.with({
      stationId: into.id,
      rank,
      currentRunId: null,
      sessionId: null,
      runnerId: null,
      ...this.spoke(saying, 'passed'),
      finishedAt: into.isCompleted ? saying.at : null,
      ...(takesOwnership ? { assignee: handMove.mover } : {}),
      revision: this.revision.next(),
    }).handedOnAt(saying.at);

    moved.record(
      new TaskMoved(moved.id, moved.workspaceId, from.key, into.key, saying.at),
    );

    if (into.isCompleted) {
      moved.record(
        new TaskFinished(moved.id, moved.workspaceId, into.id, saying.at),
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
    this.refuseAnotherRun(by, 'open a pull request for it');

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

  markTakenBy(mark: Mark, taker: TaskId): Task {
    if (
      taker.equals(this.id) ||
      !this.marks.some((each) => each.equals(mark))
    ) {
      return this;
    }

    const given = this.with({
      marks: this.marks.filter((each) => !each.equals(mark)),
    });
    given.record(new TaskMarkTaken(this.id, this.workspaceId, mark, taker));

    return given;
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
    return this.running && !this.awaitingReview;
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

  heard(saying: Saying, at: StationId | null = null): Task {
    if (at && !this.stationId.equals(at)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has moved on from that station.`,
      );
    }

    return this.with(this.spoke(saying, 'said'));
  }

  spokenTo(by: RunId, saying: Saying, at: StationId | null): Task {
    const answering =
      this.hasCurrentRun(by) ||
      (!this.running && at !== null && this.stationId.equals(at));
    const owed = answering ? this.owedConversation : null;

    if (owed && !this.owesADecision) {
      return this.answer(NotePosition.of(owed.from), saying);
    }

    const heard = this.heard(saying, at);
    const sender = saying.voice.isPerson ? saying.voice.author : null;

    if (sender && !this.running) {
      heard.record(
        new TaskActedOn(
          this.id,
          this.workspaceId,
          this.stationId,
          'sent-back',
          sender,
          by,
          saying.at,
        ),
      );
    }

    return heard;
  }

  get awaitsAnAnswer(): boolean {
    return this.running && this.awaitingReview && !this.owesADecision;
  }

  get owesADecision(): boolean {
    const asked = [...this.notes]
      .reverse()
      .find((note) => note.kind === 'asked');

    return this.awaitingReview && Boolean(asked?.approval);
  }

  settled(saying: Saying): Task {
    if (!this.trail.open) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has nothing open to settle.`,
      );
    }

    return this.with(this.spoke(saying, 'passed'));
  }

  passedOn(
    by: RunId,
    line: Line,
    to: StationId,
    rank: TaskRank,
    saying: Saying,
  ): Task {
    this.refuseAnotherRun(by, 'pass it on');

    const into = Task.stationOn(line, to);

    if (line.refusalToPass(this.stationId, into) !== null) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} cannot pass to station ${into.name.value}.`,
      );
    }

    const passed = this.relocated(line, into.id, rank, saying, null);

    passed.record(
      new TaskHandedOn(
        this.id,
        this.workspaceId,
        by,
        this.stationId,
        into.id,
        saying.at,
      ),
    );

    return passed;
  }

  finishHere(by: RunId, line: Line, saying: Saying): Task {
    this.refuseAnotherRun(by, 'finish it');

    if (!line.endsAt(this.stationId)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is not at the end of its line. It cannot finish here.`,
      );
    }

    const finished = this.with({
      currentRunId: null,
      ...this.spoke(saying, 'passed'),
      finishedAt: saying.at,
      revision: this.revision.next(),
    }).handedOnAt(saying.at);

    finished.record(
      new TaskFinished(
        finished.id,
        finished.workspaceId,
        finished.stationId,
        saying.at,
      ),
    );

    return finished;
  }

  handedTo(runId: RunId, line: Line): Task {
    if (this.currentRunId) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is already being worked by a run.`,
      );
    }

    if (!this.wantsRun(line)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is waiting on a person, finished or at a station where nothing runs.`,
      );
    }

    const handed = this.with({ currentRunId: runId });

    handed.record(new TaskHandedToRun(this.id, this.workspaceId, runId));

    return handed;
  }

  wantsRun(line: Line): boolean {
    return this.idle && Boolean(line.stationAt(this.stationId)?.harness);
  }

  dropUnstartedRun(runId: RunId): Task {
    return this.hasCurrentRun(runId) ? this.with({ currentRunId: null }) : this;
  }

  leaveRun(runId: RunId, at: Date): Task {
    return this.hasCurrentRun(runId)
      ? this.with({ currentRunId: null }).handedOnAt(at)
      : this;
  }

  private handedOnAt(at: Date): Task {
    return this.notes.length === 0
      ? this
      : this.markDeliveredUpTo(NotePosition.of(this.notes.length - 1), at);
  }

  recordSession(sessionId: HarnessSession, runnerId: RunnerId | null): Task {
    return this.with({ sessionId, runnerId });
  }

  continuity(): Continuity {
    return Continuity.of({
      key: ContinuityKey.forTask(this.id.value),
      sessionId: this.sessionId,
    });
  }

  private get lastRun(): RunId | null {
    const spoken = this.notes.filter((note) => note.voice.run !== null);

    return this.currentRunId ?? spoken[spoken.length - 1]?.voice.run ?? null;
  }

  private get trail(): Trail {
    return Trail.of(this.notes);
  }

  get owedConversation(): Conversation | null {
    return this.trail.owed;
  }

  get openConversation(): Conversation | null {
    return this.trail.open;
  }

  raisedByThem(userId: UserId): boolean {
    return this.raisedBy?.equals(userId) ?? false;
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

  get openRemarks(): readonly OpenRemark[] {
    return this.notes.flatMap((note) =>
      note.open && note.said ? [{ at: note.position, said: note.said }] : [],
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
      openRemarks: this.openRemarks.map((each) => ({
        at: each.at,
        place: each.said.place,
        body: each.said.body,
      })),
    });
  }

  remarkAt(at: NotePosition): Remark {
    const remark = this.notes[at.value]?.open
      ? this.notes[at.value]?.remark
      : null;

    if (!remark) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has no answerable remark at that note.`,
      );
    }

    return remark;
  }

  remarkAnswerableFrom(
    by: RunId,
    stationId: StationId | null,
    at: NotePosition,
  ): AnswerableRemark {
    this.refuseAnotherRun(by, 'answer a remark on it');

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
      remark: this.remarkAt(at),
    };
  }

  repliedTo(
    by: RunId,
    from: StationId | null,
    at: NotePosition,
    saying: Saying,
  ): Task {
    this.remarkAnswerableFrom(by, from, at);

    const said = this.with(this.spoke(saying, 'said'));

    return said.with({
      notes: said.notes.map((note) =>
        note.position.equals(at) ? note.answered(saying.at) : note,
      ),
    });
  }

  get undelivered(): readonly TaskNote[] {
    return this.trail.undelivered;
  }

  get allAttachments(): readonly Attachment[] {
    return [
      ...this.attachments,
      ...this.notes.flatMap((note) => note.attachments),
    ];
  }

  markDeliveredUpTo(position: NotePosition, at: Date): Task {
    return this.with({
      notes: this.notes.map((note) =>
        note.position.isAtOrBefore(position) ? note.delivered(at) : note,
      ),
    });
  }

  askedAbout(saying: Saying, by: RunId | null): Task {
    return this.asked(saying, by, null);
  }

  putToAPerson(by: RunId, saying: Saying): Task {
    return this.asked(saying, by, by);
  }

  private asked(
    saying: Saying,
    by: RunId | null,
    waiting: RunId | null,
    { overAnApproval } = { overAnApproval: false },
  ): Task {
    this.refuseAnotherRun(by, 'put it to a person');

    if (this.awaitingReview && !(overAnApproval && this.owesADecision)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is already waiting on a person.`,
      );
    }

    const spoken = this.with({
      currentRunId: waiting,
      assignee: this.assignee ?? this.raisedBy,
      ...this.spoke(saying, 'asked'),
    });
    const asked =
      waiting === null && this.running ? spoken.handedOnAt(saying.at) : spoken;

    asked.record(
      new TaskAsked(
        asked.id,
        asked.workspaceId,
        asked.stationId,
        asked.assignee,
        saying.at,
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
    saying: Saying,
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
      this.refuseAnotherRun(by, 'report a failure of it');
    }

    const deferredMoveTo = by || !this.running ? null : this.deferredMoveTo;

    if (deferredMoveTo && deferredMoveRank && line?.stationAt(deferredMoveTo)) {
      return this.failing(failure, by, saying.at, line)
        .relocated(
          line,
          deferredMoveTo,
          deferredMoveRank,
          {
            ...saying,
            body: TaskNoteBody.movedAsDeferred(
              Task.stationOn(line, deferredMoveTo).name,
              saying.body,
            ),
            form: 'failure',
            failure,
          },
          null,
        )
        .lettingGoOf(this.currentRunId);
    }

    const free = by ? this : this.stopped(saying.at);
    const earlier = free.openFailure;

    if (free.awaitingReview && earlier?.failure?.sameAs(failure)) {
      const recurred = failure.following(earlier.failure);

      return free
        .with({
          notes: free.notes.map((note) =>
            note.equals(earlier) ? note.recurred(recurred) : note,
          ),
        })
        .failing(recurred, by, saying.at, line);
    }

    const following = failure.following(earlier?.failure ?? null);
    const reported: Saying = {
      ...saying,
      form: 'failure',
      failure: following,
    };

    return (
      free.awaitingReview
        ? free.with(free.spoke(reported, 'said'))
        : free.askedAbout(reported, by)
    ).failing(following, by, saying.at, line);
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
          .handedOnAt(at)
          .lettingGoOf(this.currentRunId)
      : this;
  }

  clearFor(
    subject: ApprovalSubject,
    needed: ApprovalNeeded,
    asking: Saying,
    by: RunId,
    intent: ApprovalIntent | null,
  ): Cleared {
    this.refuseAnotherRun(by, 'use a tool on it');

    const standing = this.approvalFor(subject);

    if (standing?.approval.refuses) {
      return {
        task: this,
        check: {
          kind: 'refused',
          reason: standing.approval.decided?.reason ?? '',
        },
      };
    }

    if (standing?.approval.grantedFor(needed.askedOf)) {
      return {
        task: this.withApprovalAt(standing.at, (note) =>
          note.approvalClaimed(),
        ),
        check: {
          kind: 'given',
          claimed: standing.at,
          edited: standing.approval.goesAheadWith,
        },
      };
    }

    if (this.awaitingReview) {
      return { task: this, check: { kind: 'asked' } };
    }

    const askedOf = needed.askedOf;

    return {
      task: (askedOf ? this.with({ assignee: askedOf }) : this).putToAPerson(
        by,
        {
          ...asking,
          form: 'approval',
          approval: Approval.asked(
            subject,
            this.stationId,
            needed.because,
            intent,
            askedOf,
          ),
        },
      ),
      check: { kind: 'asked' },
    };
  }

  askToConnect(by: RunId, asking: Saying, ask: ConnectionAsk): AskedToConnect {
    this.refuseAnotherRun(by, 'ask a person to connect');

    if (this.awaitingReview) {
      const open = this.openConversation;
      const waiting = open ? this.notes[open.from]?.connectionAsk : null;

      return {
        task: this,
        asked:
          waiting?.answeredBy(ask.teamId, ask.source, ask.personId) ?? false,
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
    source: string,
    personId: UserId,
    saying: Saying,
  ): Task | null {
    const open = this.openConversation;
    const asked = open ? this.notes[open.from] : undefined;

    if (
      !open ||
      !asked?.connectionAsk?.answeredBy(teamId, source, personId) ||
      !saying.voice.author?.equals(personId)
    ) {
      return null;
    }

    const answered = this.answer(NotePosition.of(open.from), saying);

    return answered.with({
      notes: answered.notes.map((note) =>
        note.position.value === open.from ? note.connectionMet() : note,
      ),
    });
  }

  returnApproval(at: NotePosition): Task {
    return this.withApprovalAt(at, (note) => note.returnApproval());
  }

  approvalFor(subject: ApprovalSubject): StandingApproval | null {
    for (let at = this.notes.length - 1; at >= 0; at--) {
      const note = this.notes[at];
      const approval = note?.approval;

      if (note && approval?.standsFor(subject, this.stationId)) {
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
      decision !== 'granted' ||
      !edits
    ) {
      return null;
    }

    return this.notes[from.value]?.approval?.changedBy(edits) ?? null;
  }

  answer(
    from: NotePosition,
    saying: Saying,
    decision: ApprovalDecision | null = null,
    edits: ApprovalEdits | null = null,
  ): Task {
    if (this.openConversation?.from !== from.value) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is not waiting on anyone at that note.`,
      );
    }

    const by = saying.voice.author;

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

    const spoken = this.with(
      this.spoke(
        decision ? { ...saying, form: 'approval' } : saying,
        'answered',
      ),
    );
    const answered = spoken.running ? spoken : spoken.handedOnAt(saying.at);

    if (this.currentRunId) {
      answered.record(
        new TaskAnswered(this.id, this.workspaceId, this.currentRunId),
      );
    }

    if (by && saying.voice.isPerson) {
      answered.record(
        new TaskActedOn(
          this.id,
          this.workspaceId,
          this.stationId,
          decision === 'granted'
            ? 'approved'
            : decision === 'refused'
              ? 'refused'
              : 'answered',
          by,
          this.lastRun,
          saying.at,
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
              at: saying.at,
              reason: saying.body.value,
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

  private lettingGoOf(runId: RunId | null): Task {
    if (runId) {
      this.record(new TaskLetGoOfRun(this.id, this.workspaceId, runId));
    }

    return this;
  }

  private refuseAnotherRun(by: RunId | null, doing: string): void {
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

  private refuseHandMove(line: Line, to: StationId): void {
    const from = Task.stationOn(line, this.stationId);
    const into = Task.stationOn(line, to);
    const refused = line.refusalToMove(from, into);

    if (refused) {
      throw new MoveRefusedError(refused, from.name.value, into.name.value);
    }
  }

  private refuseStandingStill(stationId: StationId): void {
    if (this.stationId.equals(stationId)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} already stands at station ${stationId.value}.`,
      );
    }
  }

  private spoke(
    saying: Saying,
    kind: TaskNoteKind,
    deferredMove: DeferredMove | null = null,
  ): { notes: readonly TaskNote[]; finishedAt?: null } {
    return {
      notes: [
        ...this.notes,
        TaskNote.of({
          ...saying,
          kind,
          position: NotePosition.of(this.notes.length),
          deferredMove,
        }),
      ],
      ...(saying.voice.isStation ? {} : { finishedAt: null }),
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
      this.raisedAt,
      this.raisedBy,
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
    const gone = this.with({ currentRunId: null }).lettingGoOf(
      this.currentRunId,
    );

    gone.record(new TaskDeleted(this.id, this.workspaceId));

    return gone;
  }

  equals(other: Task): boolean {
    return this.id.equals(other.id);
  }
}
