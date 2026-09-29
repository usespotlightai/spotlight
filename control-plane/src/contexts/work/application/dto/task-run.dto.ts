import { RUN_STATES } from '@work/domain/value-objects/run-state';

export const REVIEW_STATE_NAMES = ['owed', 'settled'] as const;

interface RunReviewDto {
  readonly state: string;
  readonly conversationId: string;
}

export const RUN_STATE_NAMES = RUN_STATES;

export interface RunStationDto {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly position: number;
  readonly count: number;
}

export interface TaskRunDto {
  readonly id: string;
  readonly state: string;
  readonly attempt: number;
  readonly exitCode: number | null;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly harness: string;
  readonly image: string | null;
  readonly station: RunStationDto | null;
  readonly review: RunReviewDto | null;
}

export interface TeamRunDto extends TaskRunDto {
  readonly taskId: string | null;
  readonly taskTitle: string | null;
  readonly taskDescription: string | null;
}
