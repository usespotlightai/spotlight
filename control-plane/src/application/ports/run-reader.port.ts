import type { InboxNote } from '@application/ports/inbox-reader.port';
import type { ReviewState } from '@domain/services/conversations';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

/** A run that ended by putting its task to a person rather than passing it on. */
export interface RunReview {
  readonly state: ReviewState;
  readonly conversationId: string;
}

export interface RunStationSummary {
  readonly name: string;
  readonly color: string;
  readonly position: number;
  readonly count: number;
}

export interface TaskRunSummary {
  readonly id: string;
  readonly state: string;
  readonly attempt: number;
  readonly exitCode: number | null;
  readonly startedAt: Date;
  readonly updatedAt: Date;
  readonly harness: string;
  // Absent on a run dispatched before this was recorded, or to no station.
  readonly station: RunStationSummary | null;
  readonly review: RunReview | null;
}

export interface TeamRunSummary extends TaskRunSummary {
  readonly taskId: string | null;
  readonly taskTitle: string | null;
  readonly taskDescription: string | null;
}

export interface RunConversationSummary {
  readonly runId: string;
  readonly taskId: string;
  readonly title: string;
  readonly description: string | null;
  readonly station: RunStationSummary | null;
  readonly createdAt: Date;
  // What the run was given, word for word, not the trail that went into it.
  readonly briefing: string | null;
  readonly working: boolean;
  readonly notes: readonly InboxNote[];
}

export const RUN_READER = Symbol('RUN_READER');

export interface RunReaderPort {
  listForTask(taskId: TaskId, viewerId: UserId): Promise<TaskRunSummary[]>;

  listForTeam(teamId: TeamId, viewerId: UserId): Promise<TeamRunSummary[]>;

  conversationFor(
    runId: RunId,
    viewerId: UserId,
  ): Promise<RunConversationSummary | null>;
}
