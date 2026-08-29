import { Continuity } from '@domain/value-objects/continuity.vo';
import { WorkspaceKey } from '@domain/services/workspace-key';
import type { HarnessSession } from '@domain/value-objects/harness-session.vo';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import type { TaskDescription } from '@domain/value-objects/task-description.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import type { TaskNote } from '@domain/value-objects/task-note.vo';
import type { TaskRank } from '@domain/value-objects/task-rank.vo';
import type { TaskTitle } from '@domain/value-objects/task-title.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

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
    // The conversation this task was last worked in, kept so the run that
    // follows can take it up rather than begin again. It belongs to the task's
    // stay at one station: moving on drops it, because the note is what the
    // next station is meant to inherit.
    readonly sessionId: HarnessSession | null,
    // The runner holding the directory that conversation lives in. Resuming
    // means going back to it, so it is dropped exactly when the session is.
    readonly runnerId: RunnerId | null,
    readonly notes: readonly TaskNote[],
    readonly createdAt: Date,
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
    );
  }

  // Moved by hand, which is a station change like any other: the conversation
  // it was worked in belonged to where it was, not to where it is going.
  moveTo(stationId: StationId, rank: TaskRank): Task {
    return this.with({ stationId, rank, sessionId: null, runnerId: null });
  }

  reorderTo(rank: TaskRank): Task {
    return this.with({ rank });
  }

  /** Being worked right now, which is what holding a run means. */
  get running(): boolean {
    return this.currentRunId !== null;
  }

  /** Neither being worked nor waiting on a person: nobody has taken it up. */
  get idle(): boolean {
    return !this.running && !this.awaitingReview;
  }

  handedTo(runId: RunId): Task {
    return this.with({ currentRunId: runId });
  }

  /** Remembers the conversation a run worked this task in, and where. */
  workedIn(sessionId: HarnessSession, runnerId: RunnerId | null): Task {
    return this.with({ sessionId, runnerId });
  }

  /** Pinned only where there is a conversation to go back for. */
  continuity(): Continuity {
    return Continuity.of({
      key: WorkspaceKey.for({
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

  askedAbout(note: TaskNote): Task {
    return this.with({
      currentRunId: null,
      awaitingReview: true,
      notes: [...this.notes, note],
    });
  }

  // Passed on, so the conversation is left behind with the station that held
  // it. What travels is the note.
  passedTo(stationId: StationId, rank: TaskRank, note: TaskNote): Task {
    return this.with({
      stationId,
      rank,
      currentRunId: null,
      awaitingReview: false,
      sessionId: null,
      runnerId: null,
      notes: [...this.notes, note],
    });
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
    );
  }

  equals(other: Task): boolean {
    return this.id.equals(other.id);
  }
}
