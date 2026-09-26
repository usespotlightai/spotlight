import type { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';

export const RUN_JOURNAL = Symbol('RUN_JOURNAL');

export interface JournalEntry {
  readonly seq: number;
  readonly type: string;
  readonly at: Date;
  readonly message?: string;
  readonly data?: string;
}

export type AsideEntry = Omit<JournalEntry, 'seq'>;

export interface RunJournalPort {
  append(attempt: RunAttempt, entries: readonly JournalEntry[]): Promise<void>;

  appendAside(attempt: RunAttempt, entry: AsideEntry): Promise<number>;
}
