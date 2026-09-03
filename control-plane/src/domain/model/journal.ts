import type { Money } from '@domain/value-objects/money.vo';
import type { StepKind } from '@domain/value-objects/step-kind';

/** What a step reached in the code, as the agent named it. */
export interface StepLocation {
  readonly path: string;
  readonly line: number | null;
}

/** What a tool changed, as it reported it. */
export interface StepChange {
  readonly path: string | null;
  readonly before: string;
  readonly after: string;
}

/** One thing the agent did, as the journal reads it. */
export interface JournalStep {
  readonly kind: StepKind;
  // What it said or thought; for a command, the command itself.
  readonly text: string;
  readonly status: string | null;
  // What sort of tool it was: 'execute', 'read', 'edit', …
  readonly tool: string | null;
  readonly detail: string | null;
  readonly ms: number;
  // When it began. Without this a run can be listed but not laid against a
  // clock, and where the time went is the whole question.
  readonly startedAt: Date;
  readonly locations: readonly StepLocation[];
  // What the tool was given and what came back, unread by anything here.
  readonly given: string | null;
  readonly returned: string | null;
  readonly change: StepChange | null;
}

/** What a run cost: context against the window, and money. */
export interface RunSpent {
  readonly used: number;
  readonly size: number;
  readonly cost: Money | null;
}

/**
 * Where a run turned from being prepared, to worked, to finished. A run is not
 * one stretch of talking, and which part of it took the time is the first
 * thing worth knowing.
 */
export interface RunMarks {
  readonly startedAt: Date | null;
  // When the workspace was handed over, so what came before it was preparation.
  readonly readyAt: Date | null;
  readonly spokeFrom: Date | null;
  readonly spokeTo: Date | null;
  readonly endedAt: Date | null;
}

/** One thing a span said about itself, as the harness named it. */
export interface SpanAttribute {
  readonly name: string;
  readonly value: string;
}

/**
 * One span, where the harness reports any. The protocol cannot say which model
 * answered a turn or what a single call to it cost; a harness that speaks
 * OpenTelemetry can, and says it in a shape that nests.
 */
export interface RunSpan {
  readonly id: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly startedAt: Date;
  readonly ms: number;
  readonly failed: boolean;
  // Kept whole and unread: what a harness reports about itself is its own
  // vocabulary, and it changes between releases.
  readonly attributes: readonly SpanAttribute[];
}

/**
 * What one run did, condensed. The runner keeps every update the agent sent,
 * which runs to hundreds for a few minutes' work.
 */
export interface RunJournal {
  readonly runId: string;
  readonly attempt: number;
  readonly steps: readonly JournalStep[];
  // Empty for a harness that reports nothing of itself, which is most of them.
  readonly spans: readonly RunSpan[];
  readonly ms: number | null;
  readonly marks: RunMarks;
  readonly spent: RunSpent | null;
  // A run from before the agents spoke a protocol left terminal bytes, which
  // say nothing in this shape.
  readonly readable: boolean;
}
