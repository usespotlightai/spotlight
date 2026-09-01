import type { Station } from '@domain/entities/station.entity';
import { InvalidTaskTransitionError } from '@domain/exceptions/invalid-task-transition.error';
import { ContinuityKey } from '@domain/services/continuity-key';
import type { Conversation } from '@domain/services/conversations';
import { anyUnread } from '@domain/services/unread';
import { Branch } from '@domain/value-objects/branch.vo';
import { Continuity } from '@domain/value-objects/continuity.vo';
import type { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { NotePosition } from '@domain/value-objects/note-position.vo';
import type { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';
import type { Remark } from '@domain/value-objects/remark.vo';
import type { Repository } from '@domain/value-objects/repository.vo';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import type { Said } from '@domain/value-objects/said.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';
import type { TaskDescription } from '@domain/value-objects/task-description.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import {
  TaskNote,
  type TaskNoteKind,
} from '@domain/value-objects/task-note.vo';
import type { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import type { TaskRank } from '@domain/value-objects/task-rank.vo';
import type { TaskTitle } from '@domain/value-objects/task-title.vo';
import { Trail } from '@domain/value-objects/trail.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { Voice } from '@domain/value-objects/voice.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

/** One thing the world said that nobody has answered, and where it sits. */
export interface OpenRemark {
  readonly at: NotePosition;
  readonly said: Said;
}

/** The task says what a note did, so no caller may write one that lies. */
export interface Saying {
  readonly station: StationName;
  readonly body: TaskNoteBody;
  readonly at: Date;
  readonly voice: Voice;
  readonly said?: Said | null;
}

export class Task {
  private constructor(
    readonly id: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly stationId: StationId,
    readonly title: TaskTitle,
    readonly description: TaskDescription | null,
    readonly rank: TaskRank,
    readonly currentRunId: RunId | null,
    // The conversation it was last worked in. It belongs to one stay at one
    // station: moving on drops it, because the note is what travels.
    readonly sessionId: HarnessSession | null,
    readonly runnerId: RunnerId | null,
    readonly notes: readonly TaskNote[],
    readonly createdAt: Date,
    readonly raisedAt: StationId | null,
    readonly raisedBy: UserId | null,
    // Told to the runner as somewhere to reach, never as something to open.
    readonly repository: Repository | null,
    readonly pullRequest: PullRequestUrl | null,
    // When the line last had nothing further to do with it.
    readonly finishedAt: Date | null,
  ) {}

  static add(input: {
    workspaceId: WorkspaceId;
    stationId: StationId;
    title: TaskTitle;
    description?: TaskDescription | null;
    rank: TaskRank;
    raisedBy: UserId;
    repository?: Repository | null;
    now: Date;
    newId: () => string;
  }): Task {
    return new Task(
      TaskId.of(input.newId()),
      input.workspaceId,
      input.stationId,
      input.title,
      input.description ?? null,
      input.rank,
      null,
      null,
      null,
      [],
      input.now,
      input.stationId,
      input.raisedBy,
      input.repository ?? null,
      null,
      null,
    );
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
    repository: Repository | null;
    pullRequest: PullRequestUrl | null;
    finishedAt: Date | null;
  }): Task {
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
      input.repository,
      input.pullRequest,
      input.finishedAt,
    );
  }

  /** Landing at the end of the line is what finishes a task. */
  moveTo(into: Station, rank: TaskRank, saying: Saying): Task {
    this.refuseStandingStill(into.id, 'moved to');

    return this.with({
      stationId: into.id,
      rank,
      currentRunId: null,
      sessionId: null,
      runnerId: null,
      ...this.spoke(saying, 'passed'),
      finishedAt: into.isCompleted ? saying.at : null,
    });
  }

  reorderTo(rank: TaskRank): Task {
    return this.with({ rank });
  }

  get branch(): Branch {
    return Branch.for(this.id);
  }

  /** Opened once: asking again keeps the one already open. */
  openedAt(url: PullRequestUrl): Task {
    return this.pullRequest ? this : this.with({ pullRequest: url });
  }

  get running(): boolean {
    return this.currentRunId !== null;
  }

  /** Read from the trail, because a conversation is only what was said. */
  get awaitingReview(): boolean {
    return this.trail.awaitsAPerson;
  }

  get idle(): boolean {
    return !this.running && !this.awaitingReview && !this.finished;
  }

  get finished(): boolean {
    return this.finishedAt !== null;
  }

  /** Only a person's word is aimed at one station, so only that one names it. */
  heard(saying: Saying, at: StationId | null = null): Task {
    if (at && !this.stationId.equals(at)) {
      throw new InvalidTaskTransitionError(
        'has moved on from there, so there is nobody left to tell',
      );
    }

    return this.with(this.spoke(saying, 'said'));
  }

  /** Nothing further to do here: it settles what was open and stands still. */
  finishedHere(saying: Saying): Task {
    return this.with({
      currentRunId: null,
      ...this.spoke(saying, 'passed'),
      finishedAt: saying.at,
    });
  }

  handedTo(runId: RunId): Task {
    if (this.currentRunId) {
      throw new InvalidTaskTransitionError(
        'is already being worked, so a second run cannot take it up',
      );
    }

    return this.with({ currentRunId: runId });
  }

  workedIn(sessionId: HarnessSession, runnerId: RunnerId | null): Task {
    return this.with({ sessionId, runnerId });
  }

  /** Pinned only where there is a conversation to go back for. */
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

  /** Their inbox item. */
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

  unreadFrom(from: NotePosition): boolean {
    return anyUnread(this.conversationAt(from));
  }

  /** A conversation is read whole: it is one conversation. */
  read(from: NotePosition, at: Date): Task {
    const read = new Set(this.conversationAt(from));

    return this.with({
      notes: this.trail.marked((note) =>
        read.has(note) ? note.read(at) : note,
      ).notes,
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

  /** What the world said that the line has not answered, oldest first. */
  get openRemarks(): readonly OpenRemark[] {
    return this.notes.flatMap((note, at) =>
      note.open && note.said
        ? [{ at: NotePosition.of(at), said: note.said }]
        : [],
    );
  }

  /** The one rule for what may be answered, so nothing outside re-states it. */
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

  /** The station answers the world where the world spoke, not in the trail. */
  repliedTo(at: NotePosition, saying: Saying): Task {
    this.remarkAt(at);

    const said = this.with(this.spoke(saying, 'said'));

    return said.with({
      notes: said.notes.map((note, place) =>
        place === at.value ? note.answered(saying.at) : note,
      ),
    });
  }

  get undelivered(): readonly TaskNote[] {
    return this.trail.undelivered;
  }

  deliveredUpTo(position: NotePosition, at: Date): Task {
    let place = -1;

    return this.with({
      notes: this.trail.marked((note) => {
        place += 1;

        return NotePosition.of(place).isAtOrBefore(position)
          ? note.delivered(at)
          : note;
      }).notes,
    });
  }

  askedAbout(saying: Saying): Task {
    if (this.awaitingReview) {
      throw new InvalidTaskTransitionError(
        'is already waiting on a person, so it cannot be put to one again',
      );
    }

    return this.with({
      currentRunId: null,
      ...this.spoke(saying, 'asked'),
    });
  }

  /** It stays where it is, so the run that follows takes the conversation up. */
  answered(from: NotePosition, saying: Saying): Task {
    if (this.openConversation?.from !== from.value) {
      throw new InvalidTaskTransitionError(
        'is not waiting on anyone there, so there is nothing to answer',
      );
    }

    return this.with(this.spoke(saying, 'answered'));
  }

  private refuseStandingStill(stationId: StationId, doing: string): void {
    if (this.stationId.equals(stationId)) {
      throw new InvalidTaskTransitionError(
        `cannot be ${doing} the station it already stands at`,
      );
    }
  }

  /** A word the station did not speak is work, so it unfinishes the task. */
  private spoke(
    saying: Saying,
    kind: TaskNoteKind,
  ): { notes: readonly TaskNote[]; finishedAt?: null } {
    return {
      notes: [...this.notes, TaskNote.of({ ...saying, kind })],
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
    finishedAt?: Date | null;
  }): Task {
    return new Task(
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
      this.repository,
      part.pullRequest !== undefined ? part.pullRequest : this.pullRequest,
      part.finishedAt !== undefined ? part.finishedAt : this.finishedAt,
    );
  }

  equals(other: Task): boolean {
    return this.id.equals(other.id);
  }
}
