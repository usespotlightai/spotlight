import type { AttachmentSummary } from '@application/ports/attachment-reader.port';
import type { PersonSummary } from '@application/ports/person-reader.port';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

export interface TaskNoteSummary {
  readonly position: number;
  readonly station: string;
  readonly body: string;
}

export interface TaskReviewSummary {
  readonly conversationId: string;
}

export interface TaskLabelSummary {
  readonly id: string;
  readonly name: string;
  readonly colour: string;
}

export interface TaskSummary {
  readonly id: string;
  readonly stationId: string;
  readonly title: string;
  readonly description: string | null;
  readonly attachments: readonly AttachmentSummary[];
  readonly createdAt: Date;
  readonly running: boolean;
  readonly awaitingReview: TaskReviewSummary | null;
  readonly pullRequest: string | null;
  readonly note: TaskNoteSummary | null;
  readonly raisedBy: PersonSummary | null;
  readonly assignee: PersonSummary | null;
  readonly labels: readonly TaskLabelSummary[];
}

export const TASK_READER = Symbol('TASK_READER');

export interface TaskReaderPort {
  listForTeamMember(
    teamId: TeamId,
    userId: UserId,
  ): Promise<TaskSummary[] | null>;
}
