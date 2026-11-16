import type { AttachmentDto } from '@work/application/dto/attachment.dto';
import { HAND_BACKS } from '@work/domain/value-objects/hand-back';
import { PROGRESSES, type Progress } from '@work/domain/value-objects/progress';
import {
  TAKEOVER_VERDICTS,
  type TakeoverVerdict,
  UNSAID_TAKEOVER_VERDICT,
} from '@work/domain/value-objects/takeover-verdict';

export const PROGRESS_NAMES = PROGRESSES;

export const TAKEOVER_VERDICT_NAMES = TAKEOVER_VERDICTS;
export const UNSAID_TAKEOVER_VERDICT_NAME = UNSAID_TAKEOVER_VERDICT;

export const HAND_BACK_NAMES = HAND_BACKS;

export type TakeoverVerdictName = TakeoverVerdict;

interface TaskNoteDto {
  readonly position: number;
  readonly station: string | null;
  readonly body: string;
}

interface TaskPersonDto {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

interface TaskTakeoverDto {
  readonly by: TaskPersonDto;
  readonly verdict: TakeoverVerdict;
  readonly startedAt: string;
  readonly runId: string | null;
  readonly heldMoveTo: string | null;
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
  readonly progress: Progress | null;
  readonly awaitingReview: TaskReviewDto | null;
  readonly pullRequests: readonly string[];
  readonly note: TaskNoteDto | null;
  readonly createdBy: TaskPersonDto | null;
  readonly assignee: TaskPersonDto | null;
  readonly source: string | null;
  readonly takeover: TaskTakeoverDto | null;
}
