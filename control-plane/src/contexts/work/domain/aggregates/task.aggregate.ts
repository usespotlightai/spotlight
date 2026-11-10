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
import {
  TaskNote,
  type TaskNoteForm,
  type TaskNoteKind,
} from '@work/domain/entities/task-note.entity';
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
import { DraftAlreadySentError } from '@work/domain/exceptions/draft-already-sent.error';
import { InvalidApprovalAnswerError } from '@work/domain/exceptions/invalid-approval-answer.error';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { MoveDeniedError } from '@work/domain/exceptions/move-denied.error';
import { NoRepositoryError } from '@work/domain/exceptions/no-repository.error';
import { NotATeamMemberError } from '@work/domain/exceptions/not-a-team-member.error';
import { NothingSaidError } from '@work/domain/exceptions/nothing-said.error';
import { ReopenedByNobodyError } from '@work/domain/exceptions/reopened-by-nobody.error';
import { StaleTaskRevisionError } from '@work/domain/exceptions/stale-task-revision.error';
import { TaskNotReopenableError } from '@work/domain/exceptions/task-not-reopenable.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { UnreviewablePullRequestError } from '@work/domain/exceptions/unreviewable-pull-request.error';
import { ConversationAudience } from '@work/domain/services/conversation-audience';
import {
  type Conversation,
  notesIn,
  reopenable,
  worksOn,
} from '@work/domain/services/conversations';
import { Placement } from '@work/domain/services/placement';
import type { Outcome } from '@work/domain/services/reaction-for';
import { openSetupList } from '@work/domain/services/setup-list';
import { takesUpRun } from '@work/domain/services/taking-up';
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
import { AwaitedTurn } from '@work/domain/value-objects/awaited-turn.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import type { ConnectionAsk } from '@work/domain/value-objects/connection-ask.vo';
import { DeferredMove } from '@work/domain/value-objects/deferred-move.vo';
import { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { HeldMark } from '@work/domain/value-objects/held-mark.vo';
import type { IntegrationName } from '@work/domain/value-objects/integration-name.vo';
import { LaterPullRequest } from '@work/domain/value-objects/later-pull-request.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import type { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import {
  PullRequestLink,
  type ReviewedHead,
} from '@work/domain/value-objects/pull-request-link.vo';
import type { PullRequestStep } from '@work/domain/value-objects/pull-request-step';
import type { ResolvedHandover } from '@work/domain/value-objects/resolved-handover.vo';
import { Resume } from '@work/domain/value-objects/resume.vo';
import type { ReviewComment } from '@work/domain/value-objects/review-comment.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import type { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import type { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';
import type { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import type { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import type { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import type { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { Trail } from '@work/domain/value-objects/trail.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { WorkingCopyRelease } from '@work/domain/value-objects/working-copy-release.vo';

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
    readonly pullRequestLink: PullRequestLink | null,
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
    readonly laterPullRequests: readonly LaterPullRequest[] = [],
    readonly pullRequestClosedAt: Date | null = null,
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
    pullRequestLink?: PullRequestLink | null;
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
    laterPullRequests?: readonly LaterPullRequest[];
    pullRequestClosedAt?: Date | null;
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

    if (
      (input.laterPullRequests ?? []).length > 0 &&
      (!input.pullRequestLink || input.pullRequestLink.reviews)
    ) {
      throw new InconsistentStateError(
        'task',
        'has later pull requests but opened no first one',
      );
    }

    const opened = [
      input.pullRequestLink?.url,
      ...(input.laterPullRequests ?? []).map((each) => each.url),
    ].flatMap((each) => (each?.repository ? [each.repository] : []));

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

    if (input.pullRequestLink?.reviews && !input.pullRequestLink.reviewedHead) {
      throw new InconsistentStateError(
        'task',
        'reviews a pull request whose head it cannot check out',
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
      input.pullRequestLink ?? null,
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
      input.laterPullRequests ?? [],
      input.pullRequestClosedAt ?? null,
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

  react(line: LineMap, to: StationId, rank: TaskRank, newNote: NewNote): Task {
    if (!this.movableByHappeningTo(line, to)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has a run in progress. A happening can move it only to the completed station.`,
      );
    }

    return this.relocated(line, to, rank, newNote, null).detachRun(
      this.currentRunId,
    );
  }

  movableByHappeningTo(line: LineMap, to: StationId): boolean {
    return !this.running || line.completed.id.equals(to);
  }

  deferMove(line: LineMap, to: StationId, newNote: NewNote): Task {
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
  ): { readonly task: Task; readonly moved: boolean } {
    return this.stationId.equals(to)
      ? { task: this.reorderTo(rank), moved: false }
      : { task: this.moveTo(line, to, rank, newNote, handMove), moved: true };
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

  private assignedTo(assignee: UserId | null): Task {
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

    if (this.pullRequestIn(url.repository)) {
      return this;
    }

    const marked = this.markedBy(Mark.pullRequest(url), at);
    const opened = this.pullRequestLink
      ? marked.with({
          laterPullRequests: [
            ...this.laterPullRequests,
            LaterPullRequest.of(url, at),
          ],
        })
      : marked.with({ pullRequestLink: PullRequestLink.opened(url) });
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
    if (this.pullRequestLink) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} has its own pull request. It cannot review another.`,
      );
    }

    if (!line.stationAt(this.stationId)) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} is not on line ${line.key.value}.`,
      );
    }

    const link = PullRequestLink.reviewing(url, by);

    if (!link.reviewedHead) {
      throw new UnreviewablePullRequestError(url.value);
    }

    const reviewing = this.markedBy(Mark.review(url), at).with({
      pullRequestLink: link,
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

  get pullRequest(): PullRequestUrl | null {
    return this.pullRequestLink?.url ?? null;
  }

  get pullRequests(): readonly PullRequestUrl[] {
    const first = this.pullRequest;

    return first
      ? [first, ...this.laterPullRequests.map((each) => each.url)]
      : [];
  }

  pullRequestClosed(url: PullRequestUrl, at: Date): Task {
    if (this.reviewing) {
      return this;
    }

    if (this.pullRequest?.equals(url)) {
      return this.pullRequestClosedAt
        ? this
        : this.with({ pullRequestClosedAt: at }).closedPullRequest(url);
    }

    return this.laterPullRequests.some(
      (each) => each.url.equals(url) && each.closedAt === null,
    )
      ? this.with({
          laterPullRequests: this.laterPullRequests.map((each) =>
            each.url.equals(url) ? each.closed(at) : each,
          ),
        }).closedPullRequest(url)
      : this;
  }

  private closedPullRequest(url: PullRequestUrl): Task {
    this.record(new TaskPullRequestClosed(this.id, this.workspaceId, url));

    return this;
  }

  private reopenedPullRequest(url: PullRequestUrl): Task {
    this.record(new TaskPullRequestReopened(this.id, this.workspaceId, url));

    return this;
  }

  pullRequestReopened(url: PullRequestUrl): Task {
    if (this.pullRequest?.equals(url)) {
      return this.pullRequestClosedAt
        ? this.with({ pullRequestClosedAt: null }).reopenedPullRequest(url)
        : this;
    }

    return this.laterPullRequests.some(
      (each) => each.url.equals(url) && each.closedAt !== null,
    )
      ? this.with({
          laterPullRequests: this.laterPullRequests.map((each) =>
            each.url.equals(url) ? each.reopened() : each,
          ),
        }).reopenedPullRequest(url)
      : this;
  }

  get openPullRequests(): readonly PullRequestUrl[] {
    if (this.reviewing || !this.pullRequest) {
      return [];
    }

    return [
      ...(this.pullRequestClosedAt ? [] : [this.pullRequest]),
      ...this.laterPullRequests
        .filter((each) => each.closedAt === null)
        .map((each) => each.url),
    ];
  }

  pullRequestIn(repository: Repository | null): PullRequestUrl | null {
    if (!repository) {
      return this.pullRequest;
    }

    return (
      this.pullRequests.find(
        (each) => each.repository?.equals(repository) ?? false,
      ) ?? null
    );
  }

  pullRequestStep(repository: Repository | null): PullRequestStep {
    if (this.reviewing) {
      throw new InvalidTaskTransitionError(
        `Task ${this.id.value} reviews a pull request. It cannot open or edit one.`,
      );
    }

    const pullRequest = this.pullRequestIn(repository);

    return pullRequest ? { kind: 'edit', pullRequest } : { kind: 'open' };
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

    return this.noted(newNote, 'message');
  }

  receiveMessage(by: RunId, newNote: NewNote, at: StationId | null): Task {
    const answering =
      this.hasCurrentRun(by) ||
      (!this.running && at !== null && this.stationId.equals(at));
    const pending = answering ? this.pendingConversation : null;

    if (pending && !this.decisionPending) {
      return this.answer(pending.from, newNote);
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

  reopenableOn(line: LineMap): boolean {
    return this.finished && !line.completed.id.equals(this.stationId);
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
      case 'deferredMove':
        return this.deferMove(outcome.line, outcome.to.id, newNote);
      case 'answers':
        return this.answer(outcome.to, newNote);
      case 'moves':
        return this.react(
          outcome.line,
          outcome.to.id,
          Placement.entering('reacted', on.ranksAtDestination),
          newNote,
        );
    }
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

    return this.noted(newNote, 'passed');
  }

  resolveAt(from: NotePosition, newNote: NewNote): Task {
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

    const assigned = this.with({ currentRunId: runId });

    assigned.record(new TaskRunAssigned(this.id, this.workspaceId, runId));

    return assigned;
  }

  wantsRun(line: LineMap): boolean {
    return this.idle && Boolean(line.stationAt(this.stationId)?.harness);
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
    const byRuns = this.notes.filter((note) => note.voice.run !== null);

    return this.currentRunId ?? byRuns[byRuns.length - 1]?.voice.run ?? null;
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

  showsConversationsTo(viewer: UserId): boolean {
    return ConversationAudience.includes(this.assignee, viewer);
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

  get briefed(): BriefedTask {
    return BriefedTask.of({
      stationId: this.stationId,
      title: this.title.value,
      description: this.description?.value ?? null,
      reviewing: this.reviewedHead?.repository ?? null,
      attachments: this.attachments,
      notes: this.notes.map((note) => ({
        station: note.station?.value ?? null,
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
    const pullRequest = commented.pullRequest ?? this.pullRequest;
    const repository = pullRequest?.repository ?? null;

    if (!pullRequest || !repository) {
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
      task: (askedOf ? this.with({ assignee: askedOf }) : this).putToAPerson(
        by,
        {
          ...asking,
          form: 'approval',
          approval: Approval.request(subject, this.stationId, needed, intent),
        },
      ),
      check: { kind: 'pending' },
    };
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
    const acknowledged = noted.running
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
    pullRequestLink?: PullRequestLink | null;
    marks?: readonly HeldMark[];
    finishedAt?: Date | null;
    assignee?: UserId | null;
    draftGeneration?: DraftGeneration;
    revision?: TaskRevision;
    awaitedTurn?: AwaitedTurn | null;
    answeredTurnAt?: Date | null;
    laterPullRequests?: readonly LaterPullRequest[];
    pullRequestClosedAt?: Date | null;
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
      part.pullRequestLink !== undefined
        ? part.pullRequestLink
        : this.pullRequestLink,
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
      part.laterPullRequests ?? this.laterPullRequests,
      part.pullRequestClosedAt !== undefined
        ? part.pullRequestClosedAt
        : this.pullRequestClosedAt,
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
