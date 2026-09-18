import { EventRecorder } from '@shared-kernel/domain/aggregates/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
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
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskDeleted } from '@work/domain/events/task-deleted.event';
import { TaskFinished } from '@work/domain/events/task-finished.event';
import { TaskHandedToRun } from '@work/domain/events/task-handed-to-run.event';
import { TaskLetGoOfRun } from '@work/domain/events/task-let-go-of-run.event';
import { TaskMarkTaken } from '@work/domain/events/task-mark-taken.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import { InvalidApprovalAnswerError } from '@work/domain/exceptions/invalid-approval-answer.error';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { NoRepositoryError } from '@work/domain/exceptions/no-repository.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import type { Conversation } from '@work/domain/services/conversations';
import { anyUnread } from '@work/domain/services/unread';
import {
  Approval,
  type ApprovalDecision,
} from '@work/domain/value-objects/approval.vo';
import type { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import type { Clearance } from '@work/domain/value-objects/clearance';
import { Continuity } from '@work/domain/value-objects/continuity.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import type { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import type { Remark } from '@work/domain/value-objects/remark.vo';
import type { Said } from '@work/domain/value-objects/said.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { StationName } from '@work/domain/value-objects/station-name.vo';
import type { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import type { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import type { TaskRank } from '@work/domain/value-objects/task-rank.vo';
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
}

export interface StandingApproval {
  readonly at: NotePosition;
  readonly approval: Approval;
}

export interface Cleared {
  readonly task: Task;
  readonly clearance: Clearance;
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
    readonly pullRequest: PullRequestUrl | null,
    readonly marks: readonly Mark[],
    readonly finishedAt: Date | null,
    readonly assignee: UserId | null,
    readonly attachments: readonly Attachment[],
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
    heard?: boolean;
    proposedIn?: ProposalOrigin | null;
    now: Date;
    newId: () => string;
  }): Task {
    const station = Task.stationOn(input.line, input.at);
    const raisedBy = input.raisedBy ?? null;

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
        task.stationId,
        input.heard ?? false,
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
    pullRequest: PullRequestUrl | null;
    marks?: readonly Mark[];
    finishedAt: Date | null;
    assignee?: UserId | null;
    attachments?: readonly Attachment[];
    version?: number;
  }): Task {
    if (input.finishedAt !== null && input.currentRunId !== null) {
      throw new InconsistentStateError(
        'task',
        'is finished yet still held by a run',
      );
    }

    if (input.notes.some((note, place) => note.position.value !== place)) {
      throw new InconsistentStateError('task', 'has a gap in its trail');
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
      input.pullRequest,
      input.marks ?? [],
      input.finishedAt,
      input.assignee ?? null,
      input.attachments ?? [],
      input.version ?? 0,
    );
  }

  moveTo(
    line: Line,
    to: StationId,
    rank: TaskRank,
    saying: Saying,
    handMove: { mover: UserId } | null = null,
  ): Task {
    return this.relocated(line, to, rank, saying, handMove).lettingGoOf(
      this.currentRunId,
    );
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

    this.refuseStandingStill(into.id, 'moved to');

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
    });

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

  assignedTo(userId: UserId): Task {
    return this.with({ assignee: userId });
  }

  unassigned(): Task {
    return this.with({ assignee: null });
  }

  claimedBy(userId: UserId): Task {
    return this.assignee ? this : this.with({ assignee: userId });
  }

  get branch(): Branch {
    return Branch.for(this.id);
  }

  openedAt(by: RunId, url: PullRequestUrl): Task {
    this.refuseAnotherRun(by, 'open a pull request for it');

    if (this.pullRequest) {
      return this;
    }

    const opened = this.markedBy(Mark.pullRequest(url)).with({
      pullRequest: url,
    });
    opened.record(new PullRequestOpened(opened.id, opened.workspaceId, url));

    return opened;
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

  heldBy(runId: RunId): boolean {
    return this.currentRunId?.equals(runId) ?? false;
  }

  get awaitingReview(): boolean {
    return this.trail.awaitsAPerson;
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
        'has moved on from there, so there is nobody left to tell',
      );
    }

    return this.with(this.spoke(saying, 'said'));
  }

  settled(saying: Saying): Task {
    if (!this.trail.open) {
      throw new InvalidTaskTransitionError(
        'has nothing open, so there is nothing left on it to settle',
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
        `cannot be passed from where it stands to ${into.name.value}`,
      );
    }

    return this.relocated(line, into.id, rank, saying, null);
  }

  finishedHere(by: RunId, line: Line, saying: Saying): Task {
    this.refuseAnotherRun(by, 'finish it');

    if (!line.endsAt(this.stationId)) {
      throw new InvalidTaskTransitionError(
        'stands where its line does not end, so it cannot be finished there',
      );
    }

    const finished = this.with({
      currentRunId: null,
      ...this.spoke(saying, 'passed'),
      finishedAt: saying.at,
    });

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
        'is already being worked, so a second run cannot take it up',
      );
    }

    if (!this.wantsRun(line)) {
      throw new InvalidTaskTransitionError(
        'is waiting on a person, finished, or stands where nothing runs, so no run can take it up',
      );
    }

    const handed = this.with({ currentRunId: runId });

    handed.record(new TaskHandedToRun(this.id, this.workspaceId, runId));

    return handed;
  }

  wantsRun(line: Line): boolean {
    return this.idle && Boolean(line.stationAt(this.stationId)?.harness);
  }

  runNeverStarted(runId: RunId): Task {
    return this.heldBy(runId) ? this.with({ currentRunId: null }) : this;
  }

  workedIn(sessionId: HarnessSession, runnerId: RunnerId | null): Task {
    return this.with({ sessionId, runnerId });
  }

  continuity(): Continuity {
    return Continuity.of({
      key: ContinuityKey.for({
        taskId: this.id.value,
        stationId: this.stationId.value,
      }),
      sessionId: this.sessionId,
      pinnedTo: this.sessionId ? this.runnerId : null,
    });
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
        'was not put to anyone there, so there is nothing to read',
      );
    }

    return conversation;
  }

  get openRemarks(): readonly OpenRemark[] {
    return this.notes.flatMap((note) =>
      note.open && note.said ? [{ at: note.position, said: note.said }] : [],
    );
  }

  remarkAt(at: NotePosition): Remark {
    const remark = this.notes[at.value]?.open
      ? this.notes[at.value]?.remark
      : null;

    if (!remark) {
      throw new InvalidTaskTransitionError(
        'was not said anywhere answerable there, so there is nothing to answer',
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
        'has moved on from there, so there is nothing left to answer for',
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

  deliveredUpTo(position: NotePosition, at: Date): Task {
    return this.with({
      notes: this.notes.map((note) =>
        note.position.isAtOrBefore(position) ? note.delivered(at) : note,
      ),
    });
  }

  askedAbout(saying: Saying, by: RunId | null): Task {
    this.refuseAnotherRun(by, 'put it to a person');

    if (this.awaitingReview) {
      throw new InvalidTaskTransitionError(
        'is already waiting on a person, so it cannot be put to one again',
      );
    }

    const asked = this.with({
      currentRunId: null,
      assignee: this.assignee ?? this.raisedBy,
      ...this.spoke(saying, 'asked'),
    });

    asked.record(
      new TaskAsked(
        asked.id,
        asked.workspaceId,
        asked.stationId,
        asked.assignee,
      ),
    );

    return asked;
  }

  clearFor(
    call: ToolCall,
    needed: ApprovalNeeded,
    asking: Saying,
    by: RunId,
  ): Cleared {
    this.refuseAnotherRun(by, 'use a tool on it');

    const standing = this.approvalFor(call);

    if (standing?.approval.refuses) {
      return {
        task: this,
        clearance: {
          kind: 'refused',
          reason: standing.approval.decided?.reason ?? '',
        },
      };
    }

    if (standing?.approval.grants) {
      return {
        task: this.withApprovalAt(standing.at, (note) =>
          note.approvalClaimed(),
        ),
        clearance: { kind: 'given', claimed: standing.at },
      };
    }

    return {
      task: this.askedAbout(
        {
          ...asking,
          form: 'approval',
          approval: Approval.asked(call, this.stationId, needed.because),
        },
        by,
      ),
      clearance: { kind: 'asked' },
    };
  }

  approvalReturned(at: NotePosition): Task {
    return this.withApprovalAt(at, (note) => note.approvalReturned());
  }

  approvalFor(call: ToolCall): StandingApproval | null {
    for (let at = this.notes.length - 1; at >= 0; at--) {
      const note = this.notes[at];
      const approval = note?.approval;

      if (note && approval?.standsFor(call, this.stationId)) {
        return { at: note.position, approval };
      }
    }

    return null;
  }

  answered(
    from: NotePosition,
    saying: Saying,
    decision: ApprovalDecision | null = null,
  ): Task {
    if (this.openConversation?.from !== from.value) {
      throw new InvalidTaskTransitionError(
        'is not waiting on anyone there, so there is nothing to answer',
      );
    }

    const by = saying.voice.author;

    if (decision && !this.notes[from.value]?.approval) {
      throw new InvalidApprovalAnswerError(
        'waits on nothing being approved, so there is nothing there to approve',
      );
    }

    if (decision && !by) {
      throw new InvalidApprovalAnswerError(
        'can only be approved or rejected by a person',
      );
    }

    const answered = this.with(
      this.spoke(
        decision ? { ...saying, form: 'approval' } : saying,
        'answered',
      ),
    );

    return decision && by
      ? answered.withApprovalAt(from, (note) =>
          note.decided(decision, {
            by,
            at: saying.at,
            reason: saying.body.value,
          }),
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
    const holding = by ? this.heldBy(by) : !this.running;

    if (!holding) {
      throw new InvalidTaskTransitionError(
        `is not being worked by that run, so it cannot ${doing}`,
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

  private refuseStandingStill(stationId: StationId, doing: string): void {
    if (this.stationId.equals(stationId)) {
      throw new InvalidTaskTransitionError(
        `cannot be ${doing} the station it already stands at`,
      );
    }
  }

  private spoke(
    saying: Saying,
    kind: TaskNoteKind,
  ): { notes: readonly TaskNote[]; finishedAt?: null } {
    return {
      notes: [
        ...this.notes,
        TaskNote.of({
          ...saying,
          kind,
          position: NotePosition.of(this.notes.length),
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
    pullRequest?: PullRequestUrl | null;
    marks?: readonly Mark[];
    finishedAt?: Date | null;
    assignee?: UserId | null;
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
      part.pullRequest !== undefined ? part.pullRequest : this.pullRequest,
      part.marks ?? this.marks,
      part.finishedAt !== undefined ? part.finishedAt : this.finishedAt,
      part.assignee !== undefined ? part.assignee : this.assignee,
      this.attachments,
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
