import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

export interface TaskSummary {
  readonly id: string;
  readonly stationId: string;
  readonly title: string;
  readonly description: string | null;
  readonly createdAt: Date;
}

export const TASK_READER = Symbol('TASK_READER');

export interface TaskReaderPort {
  listForTeamMember(
    teamId: TeamId,
    userId: UserId,
  ): Promise<TaskSummary[] | null>;
}
