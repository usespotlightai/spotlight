import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { Page, PageRequest } from '@work/application/dto/page.dto';
import type { AttachmentSummary } from '@work/application/ports/attachment-reader.port';
import type { Progress } from '@work/domain/value-objects/progress';

export interface TaskNoteSummary {
  readonly position: number;
  readonly station: string | null;
  readonly body: string;
}

interface TaskReviewSummary {
  readonly conversationId: string;
}

interface TaskPersonSummary {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
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
  readonly pullRequests: readonly string[];
  readonly note: TaskNoteSummary | null;
  readonly createdBy: TaskPersonSummary | null;
  readonly assignee: TaskPersonSummary | null;
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
