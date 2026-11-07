import type { PersonSummary } from '@identity/application/ports/person-reader.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { Page, PageRequest } from '@work/application/dto/page.dto';
import type { AttachmentSummary } from '@work/application/ports/attachment-reader.port';
import type { Progress } from '@work/domain/value-objects/progress';

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
  readonly progress: Progress | null;
  readonly awaitingReview: TaskReviewSummary | null;
  readonly pullRequest: string | null;
  readonly note: TaskNoteSummary | null;
  readonly createdBy: PersonSummary | null;
  readonly assignee: PersonSummary | null;
}

export type TaskListing =
  | { readonly state: 'board' }
  | {
      readonly state: 'completed-station';
      readonly lineId: string | null;
      readonly page: PageRequest;
    };

export const TASK_READER = Symbol('TASK_READER');

export interface TaskReaderPort {
  listForTeam(teamId: TeamId, listing: TaskListing): Promise<Page<TaskSummary>>;

  findInTeam(teamId: TeamId, taskId: TaskId): Promise<TaskSummary | null>;
}
