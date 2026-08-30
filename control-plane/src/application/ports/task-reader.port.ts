import type { PersonSummary } from '@application/ports/person-reader.port';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

/** The last thing said about a task, as the board reads it. */
export interface TaskNoteSummary {
  // What identifies it: notes are appended and never reordered.
  readonly position: number;
  readonly station: string;
  readonly body: string;
}

export interface TaskSummary {
  readonly id: string;
  readonly stationId: string;
  readonly title: string;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly running: boolean;
  readonly awaitingReview: boolean;
  // The last thing said about it, which is why it is where it is.
  readonly note: TaskNoteSummary | null;
  readonly raisedBy: PersonSummary | null;
}

export const TASK_READER = Symbol('TASK_READER');

export interface TaskReaderPort {
  listForTeamMember(
    teamId: TeamId,
    userId: UserId,
  ): Promise<TaskSummary[] | null>;
}
