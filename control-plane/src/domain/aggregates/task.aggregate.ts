import type { RunId } from '@domain/value-objects/run-id.vo';
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
      input.notes,
      input.createdAt,
    );
  }

  moveTo(stationId: StationId, rank: TaskRank): Task {
    return this.placed(stationId, rank);
  }

  reorderTo(rank: TaskRank): Task {
    return this.placed(this.stationId, rank);
  }

  handedTo(runId: RunId): Task {
    return this.with({ currentRunId: runId });
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

  passedTo(stationId: StationId, rank: TaskRank, note: TaskNote): Task {
    return this.with({
      stationId,
      rank,
      currentRunId: null,
      awaitingReview: false,
      notes: [...this.notes, note],
    });
  }

  private placed(stationId: StationId, rank: TaskRank): Task {
    return this.with({ stationId, rank });
  }

  private with(part: {
    stationId?: StationId;
    rank?: TaskRank;
    currentRunId?: RunId | null;
    awaitingReview?: boolean;
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
      part.notes ?? this.notes,
      this.createdAt,
    );
  }

  equals(other: Task): boolean {
    return this.id.equals(other.id);
  }
}
