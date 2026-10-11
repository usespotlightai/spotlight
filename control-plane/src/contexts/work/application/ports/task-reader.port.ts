import type { PersonSummary } from '@identity/application/ports/person-reader.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { AttachmentSummary } from '@work/application/ports/attachment-reader.port';

export interface TaskNoteSummary {
  readonly position: number;
  readonly station: string;
  readonly body: string;
}

interface TaskReviewSummary {
  readonly conversationId: string;
}

export interface TaskSummary {
  readonly id: string;
  readonly stationId: string;
  readonly revision: number;
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
}

export const TASK_READER = Symbol('TASK_READER');

export interface TaskReaderPort {
  listForTeamMember(
    teamId: TeamId,
    userId: UserId,
  ): Promise<TaskSummary[] | null>;

  firstOpenedFrom(teamId: TeamId): Promise<ReadonlyMap<string, Date>>;
}
