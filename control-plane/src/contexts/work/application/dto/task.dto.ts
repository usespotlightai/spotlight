import type { AttachmentDto } from '@work/application/dto/attachment.dto';
import { WORKS } from '@work/domain/value-objects/run-state';

export const WORK_NAMES = WORKS;

interface TaskNoteDto {
  readonly position: number;
  readonly station: string;
  readonly body: string;
}

interface TaskPersonDto {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

interface TaskReviewDto {
  readonly conversationId: string;
}

export interface TaskDto {
  readonly id: string;
  readonly stationId: string;
  readonly revision: number;
  readonly title: string;
  readonly description: string | null;
  readonly attachments: readonly AttachmentDto[];
  readonly createdAt: string;
  readonly work: string | null;
  readonly awaitingReview: TaskReviewDto | null;
  readonly pullRequest: string | null;
  readonly note: TaskNoteDto | null;
  readonly createdBy: TaskPersonDto | null;
  readonly assignee: TaskPersonDto | null;
}
