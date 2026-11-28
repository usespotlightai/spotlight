import { RUNNER_SOURCE_KIND_FACTS } from '@runs/application/ports/run-facts.port';
import type { RunWaitingDto } from '@work/application/dto/run-waiting.dto';
import { REVIEW_STATES } from '@work/domain/services/conversations';
import {
  MESSAGE_OUTCOMES,
  type MessageOutcome,
} from '@work/domain/services/message-effect';
import {
  RUN_DRIVERS,
  type RunDriver,
} from '@work/domain/value-objects/dispatch-subject';
import type { Progress } from '@work/domain/value-objects/progress';
import { TASK_RUN_STATES } from '@work/domain/value-objects/task-run-state';

export const REVIEW_STATE_NAMES = REVIEW_STATES;

interface RunReviewDto {
  readonly state: string;
  readonly conversationId: string;
}

export const RUN_STATE_NAMES = TASK_RUN_STATES;

export const RUN_DRIVER_NAMES = RUN_DRIVERS;

export const MESSAGE_OUTCOME_NAMES = MESSAGE_OUTCOMES;

export const RUNNER_SOURCE_KIND_NAMES = RUNNER_SOURCE_KIND_FACTS;

interface RunRanOnDto {
  readonly kind: (typeof RUNNER_SOURCE_KIND_NAMES)[number];
  readonly key: string;
  readonly platform: boolean;
}

type RunDriverName = RunDriver;

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
  readonly ranOn: RunRanOnDto | null;
  readonly waiting: RunWaitingDto | null;
  readonly station: RunStationDto | null;
  readonly review: RunReviewDto | null;
  readonly progress: Progress | null;
  readonly waitingForYou: boolean;
  readonly yourMessage: MessageOutcome;
  readonly stoppableByYou: boolean;
  readonly driver: RunDriverName;
}

export interface TeamRunDto extends TaskRunDto {
  readonly taskId: string | null;
  readonly taskTitle: string | null;
  readonly taskDescription: string | null;
}
