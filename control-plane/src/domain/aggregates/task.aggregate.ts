import { InvalidTaskTransitionError } from '@domain/exceptions/invalid-task-transition.error';
import { ContinuityKey } from '@domain/services/continuity-key';
import { type Stretch, stretchesOf } from '@domain/services/stretches';
import { Continuity } from '@domain/value-objects/continuity.vo';
import type { HarnessSession } from '@domain/value-objects/harness-session.vo';
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

/**
 * What is being written down. The task itself says what the note did, so no
 * caller can write one that means something the task did not do.
 */
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
    readonly awaitingReview: boolean,
    // The conversation it was last worked in. It belongs to one stay at one
    // station: moving on drops it, because the note is what travels.
    readonly sessionId: HarnessSession | null,
    // The runner holding what the last run left, so it is dropped exactly
    // when the session is.
    readonly runnerId: RunnerId | null,
    readonly notes: readonly TaskNote[],
    readonly createdAt: Date,
    // Where it was raised, which it keeps as it moves.
    readonly raisedAt: StationId | null,
  ) {}

  static add(input: {
    workspaceId: WorkspaceId;
    stationId: StationId;
    title: TaskTitle;
    description?: TaskDescription | null;
    rank: TaskRank;
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
      false,
      null,
      null,
      [],
      input.now,
      input.stationId,
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
    awaitingReview: boolean;
    sessionId: HarnessSession | null;
    runnerId: RunnerId | null;
    notes: readonly TaskNote[];
    createdAt: Date;
    raisedAt: StationId | null;
  }): Task {
    return new Task(
      input.id,
      input.workspaceId,
      input.stationId,
      input.title,
      input.description,
      input.rank,
      input.currentRunId,
      input.awaitingReview,
      input.sessionId,
      input.runnerId,
      input.notes,
      input.createdAt,
      input.raisedAt,
    );
  }

  /**
   * Moved by hand, which closes anything a person was owed here just as
   * passing it on would.
   */
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

  /** Neither being worked nor waiting on a person: nobody has taken it up. */
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

  note(note: TaskNote): Task {
    return this.with({ notes: [...this.notes, note] });
  }

  /** The stretch a person is still owed the end of, if there is one. */
  get owed(): Stretch | null {
    const cut = stretchesOf(this.notes.map((each) => each.kind));
    const last = cut[cut.length - 1];

    return last && last.to === null ? last : null;
  }

  /** Put to a person, who holds it from here until it moves on. */
  askedAbout(saying: Saying): Task {
    if (this.awaitingReview) {
      throw new InvalidTaskTransitionError(
        'is already waiting on a person, so it cannot be put to one again',
      );
    }

    return this.with({
      currentRunId: null,
      awaitingReview: true,
      notes: [...this.notes, this.wrote(saying, 'asked')],
    });
  }

  /**
   * Answered, so it can be worked again. It stays where it is, which is what
   * lets the run that follows take the conversation up.
   */
  answered(saying: Saying): Task {
    if (!this.owed) {
      throw new InvalidTaskTransitionError(
        'was not put to anyone, so there is nothing to answer',
      );
    }

    return this.with({
      awaitingReview: false,
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
      awaitingReview: false,
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
    awaitingReview?: boolean;
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
      part.awaitingReview ?? this.awaitingReview,
      part.sessionId !== undefined ? part.sessionId : this.sessionId,
      part.runnerId !== undefined ? part.runnerId : this.runnerId,
      part.notes ?? this.notes,
      this.createdAt,
      this.raisedAt,
    );
  }

  equals(other: Task): boolean {
    return this.id.equals(other.id);
  }
}
