import type { AttachmentDto } from '@work/application/dto/attachment.dto';
import type { MessageOutcome } from '@work/domain/services/message-effect';
import { HOLD_ENDS } from '@work/domain/value-objects/hold-end';
import { HOLD_VERDICTS } from '@work/domain/value-objects/hold-verdict';
import { PROGRESSES, type Progress } from '@work/domain/value-objects/progress';

export const PROGRESS_NAMES = PROGRESSES;

export const HOLD_VERDICT_NAMES = HOLD_VERDICTS;

export const HOLD_END_NAMES = HOLD_ENDS;

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

interface TaskHoldDto {
  readonly by: TaskPersonDto;
  readonly startedAt: string;
  readonly runId: string | null;
  readonly heldMoveTo: string | null;
  readonly chatId: string | null;
  readonly viewerDrives: boolean;
  readonly viewerEnds: boolean;
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
  readonly waitingForYou: boolean;
  readonly yourMessage: MessageOutcome;
  readonly finished: boolean;
  readonly sendsBackTo: readonly string[];
  readonly pullRequests: readonly string[];
  readonly note: TaskNoteDto | null;
  readonly createdBy: TaskPersonDto | null;
  readonly assignee: TaskPersonDto | null;
  readonly source: string | null;
  readonly hold: TaskHoldDto | null;
  readonly runNotStarted: TaskRunNotStartedDto | null;
}

interface TaskRunNotStartedDto {
  readonly harness: string;
}
