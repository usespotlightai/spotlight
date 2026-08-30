import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

/** One thing the agent did, as the journal reads it. */
export interface JournalStep {
  readonly kind: 'said' | 'thought' | 'tool';
  // What it said or thought; for a command, the command itself.
  readonly text: string;
  readonly status: string | null;
  // What sort of tool it was: 'execute', 'read', 'edit', …
  readonly tool: string | null;
  readonly detail: string | null;
  readonly ms: number;
}

/** What a run cost: context against the window, and money. */
export interface RunSpent {
  readonly used: number;
  readonly size: number;
  readonly cost: number | null;
  readonly currency: string | null;
}

/**
 * What one run did, condensed. The runner keeps every update the agent sent,
 * which runs to hundreds for a few minutes' work.
 */
export interface RunJournal {
  readonly runId: string;
  readonly attempt: number;
  readonly steps: readonly JournalStep[];
  readonly ms: number | null;
  readonly spent: RunSpent | null;
  // A run from before the agents spoke a protocol left terminal bytes, which
  // say nothing in this shape.
  readonly readable: boolean;
}

export const RUN_JOURNAL_READER = Symbol('RUN_JOURNAL_READER');

export interface RunJournalReaderPort {
  /** Every run that worked this task, oldest first. Null if it is not theirs. */
  listForTask(taskId: TaskId, viewerId: UserId): Promise<RunJournal[] | null>;
}
