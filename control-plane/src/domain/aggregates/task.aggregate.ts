import { InvalidTaskTransitionError } from '@domain/exceptions/invalid-task-transition.error';
import { ContinuityKey } from '@domain/services/continuity-key';
import {
  awaitsAPerson,
  type Conversation,
  conversationsOf,
  notesIn,
  stillOpen,
} from '@domain/services/conversations';
import { anyUnread } from '@domain/services/unread';
import { Continuity } from '@domain/value-objects/continuity.vo';
import type { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { NotePosition } from '@domain/value-objects/note-position.vo';
import type { Repository } from '@domain/value-objects/repository.vo';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
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
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

/** The task says what a note did, so no caller may write one that lies. */
export interface Saying {
  readonly station: StationName;
  readonly body: TaskNoteBody;
  readonly at: Date;
  readonly run?: RunId | null;
  readonly author?: UserId | null;
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
    );
  }

  /** Moved by hand closes what was asked here, as passing it on would. */
  moveTo(stationId: StationId, rank: TaskRank, saying: Saying): Task {
    this.refuseStandingStill(stationId, 'moved to');

    return this.with({
      stationId,
      rank,
      sessionId: null,
      runnerId: null,
      notes: [...this.notes, this.wrote(saying, 'passed')],
    });
  }

  reorderTo(rank: TaskRank): Task {
    return this.with({ rank });
  }

  get running(): boolean {
    return this.currentRunId !== null;
  }

  /** Read from the trail, so it cannot drift from what was actually said. */
  get awaitingReview(): boolean {
    return awaitsAPerson(this.notes);
  }

  get idle(): boolean {
    return !this.running && !this.awaitingReview;
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

  get openConversation(): Conversation | null {
    const cut = conversationsOf(this.notes.map((each) => each.kind));
    const last = cut[cut.length - 1];

    return last && stillOpen(last) ? last : null;
  }

  raisedByThem(userId: UserId): boolean {
    return this.raisedBy?.equals(userId) ?? false;
  }

  unreadFrom(from: NotePosition): boolean {
    return anyUnread(this.within(from));
  }

  /** A conversation is read whole: it is one conversation. */
  read(from: NotePosition, at: Date): Task {
    const read = new Set(this.within(from));

    return this.with({
      notes: this.notes.map((note) => (read.has(note) ? note.read(at) : note)),
    });
  }

  private within(from: NotePosition): readonly TaskNote[] {
    const conversation = conversationsOf(
      this.notes.map((each) => each.kind),
    ).find((each) => each.from === from.value);

    if (!conversation) {
      throw new InvalidTaskTransitionError(
        'was not put to anyone there, so there is nothing to read',
      );
    }

    return notesIn(conversation, this.notes);
  }

  /** Only while the task is still where that agent is. */
  told(stationId: StationId, saying: Saying): Task {
    if (!this.stationId.equals(stationId)) {
      throw new InvalidTaskTransitionError(
        'has moved on from there, so there is nobody left to tell',
      );
    }

    return this.with({ notes: [...this.notes, this.wrote(saying, 'said')] });
  }

  get undelivered(): readonly TaskNote[] {
    return this.notes.filter((each) => each.undelivered);
  }

  deliveredUpTo(position: NotePosition, at: Date): Task {
    return this.with({
      notes: this.notes.map((note, place) =>
        NotePosition.of(place).isAtOrBefore(position)
          ? note.delivered(at)
          : note,
      ),
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
      notes: [...this.notes, this.wrote(saying, 'asked')],
    });
  }

  /** It stays where it is, so the run that follows takes the conversation up. */
  answered(from: NotePosition, saying: Saying): Task {
    if (this.openConversation?.from !== from.value) {
      throw new InvalidTaskTransitionError(
        'is not waiting on anyone there, so there is nothing to answer',
      );
    }

    return this.with({
      notes: [...this.notes, this.wrote(saying, 'answered')],
    });
  }

  passedTo(stationId: StationId, rank: TaskRank, saying: Saying): Task {
    // Passing a task to where it already stands moves nothing and starts the
    // same work again.
    this.refuseStandingStill(stationId, 'passed to');

    return this.with({
      stationId,
      rank,
      currentRunId: null,
      sessionId: null,
      runnerId: null,
      notes: [...this.notes, this.wrote(saying, 'passed')],
    });
  }

  private refuseStandingStill(stationId: StationId, doing: string): void {
    if (this.stationId.equals(stationId)) {
      throw new InvalidTaskTransitionError(
        `cannot be ${doing} the station it already stands at`,
      );
    }
  }

  /** A note only the task may write, because only it knows what it did. */
  private wrote(saying: Saying, kind: TaskNoteKind): TaskNote {
    return TaskNote.of({ ...saying, kind });
  }

  private with(part: {
    stationId?: StationId;
    rank?: TaskRank;
    currentRunId?: RunId | null;
    sessionId?: HarnessSession | null;
    runnerId?: RunnerId | null;
    notes?: readonly TaskNote[];
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
    );
  }

  equals(other: Task): boolean {
    return this.id.equals(other.id);
  }
}
