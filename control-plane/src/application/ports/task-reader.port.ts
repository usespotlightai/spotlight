import type { TaskNoteDto } from '@application/dto/task.dto';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

export interface TaskSummary {
  readonly id: string;
  readonly stationId: string;
  readonly title: string;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly running: boolean;
  readonly awaitingReview: boolean;
  // The last thing said about it, which is why it is where it is.
  readonly note: TaskNoteDto | null;
}

export const TASK_READER = Symbol('TASK_READER');

export interface TaskReaderPort {
  listForTeamMember(
    teamId: TeamId,
    userId: UserId,
  ): Promise<TaskSummary[] | null>;
}
