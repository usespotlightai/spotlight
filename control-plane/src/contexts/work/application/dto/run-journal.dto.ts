import { STEP_KINDS } from '@work/domain/value-objects/step-kind';

export const STEP_KIND_NAMES = STEP_KINDS;

interface StepLocationDto {
  readonly path: string;
  readonly line: number | null;
}

interface StepChangeDto {
  readonly path: string | null;
  readonly before: string;
  readonly after: string;
}

export interface JournalStepDto {
  readonly kind: string;
  readonly text: string;
  readonly status: string | null;
  readonly tool: string | null;
  readonly detail: string | null;
  readonly ms: number;
  readonly startedAt: string;
  readonly locations: readonly StepLocationDto[];
  readonly given: string | null;
  readonly returned: string | null;
  readonly change: StepChangeDto | null;
}

interface SpanAttributeDto {
  readonly name: string;
  readonly value: string;
}

export interface RunSpanDto {
  readonly id: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly startedAt: string;
  readonly ms: number;
  readonly failed: boolean;
  readonly attributes: readonly SpanAttributeDto[];
}

interface RunMarksDto {
  readonly startedAt: string | null;
  readonly readyAt: string | null;
  readonly firstAgentUpdateAt: string | null;
  readonly lastAgentUpdateAt: string | null;
  readonly endedAt: string | null;
}

interface RunSpentDto {
  readonly used: number;
  readonly size: number;
  readonly cost: number | null;
  readonly currency: string | null;
}

export interface RunJournalDto {
  readonly runId: string;
  readonly attempt: number;
  readonly steps: readonly JournalStepDto[];
  readonly spans: readonly RunSpanDto[];
  readonly ms: number | null;
  readonly marks: RunMarksDto;
  readonly spent: RunSpentDto | null;
}
