import type { Money } from '@domain/value-objects/money.vo';
import type { StepKind } from '@domain/value-objects/step-kind';

export interface StepLocation {
  readonly path: string;
  readonly line: number | null;
}

export interface StepChange {
  readonly path: string | null;
  readonly before: string;
  readonly after: string;
}

export interface JournalStep {
  readonly kind: StepKind;
  readonly text: string;
  readonly status: string | null;
  readonly tool: string | null;
  readonly detail: string | null;
  readonly ms: number;
  readonly startedAt: Date;
  readonly locations: readonly StepLocation[];
  readonly given: string | null;
  readonly returned: string | null;
  readonly change: StepChange | null;
}

export interface RunSpent {
  readonly used: number;
  readonly size: number;
  readonly cost: Money | null;
}

export interface RunMarks {
  readonly startedAt: Date | null;
  readonly readyAt: Date | null;
  readonly spokeFrom: Date | null;
  readonly spokeTo: Date | null;
  readonly endedAt: Date | null;
}

export interface SpanAttribute {
  readonly name: string;
  readonly value: string;
}

export interface RunSpan {
  readonly id: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly startedAt: Date;
  readonly ms: number;
  readonly failed: boolean;
  readonly attributes: readonly SpanAttribute[];
}

export interface RunJournal {
  readonly runId: string;
  readonly attempt: number;
  readonly steps: readonly JournalStep[];
  readonly spans: readonly RunSpan[];
  readonly ms: number | null;
  readonly marks: RunMarks;
  readonly spent: RunSpent | null;
}
