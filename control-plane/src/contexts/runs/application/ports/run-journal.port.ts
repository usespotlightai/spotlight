import type { HookCallTrace } from '@runs/application/ports/hook-traces.port';
import type { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';

export const RUN_JOURNAL = Symbol('RUN_JOURNAL');

export interface JournalEntry {
  readonly seq: number;
  readonly type: string;
  readonly at: Date;
  readonly message?: string;
  readonly data?: string;
}

export interface HookCalledFacts {
  readonly type: 'hook.called';
  readonly call: HookCallTrace;
}

export interface ProvisionFailedFacts {
  readonly type: 'provision.failed';
  readonly failure: string;
  readonly detail: string;
}

export interface RunPausedFacts {
  readonly type: 'run.paused';
  readonly resumesAtOnce: boolean;
}

export type ControlPlaneFacts =
  | HookCalledFacts
  | ProvisionFailedFacts
  | RunPausedFacts;

export interface UnreadableFacts {
  readonly type: 'unreadable';
  readonly entryType: string;
}

export type ControlPlaneEntry = ControlPlaneFacts & { readonly at: Date };

export interface RunJournalPort {
  append(attempt: RunAttempt, entries: readonly JournalEntry[]): Promise<void>;

  appendControlPlaneEntry(
    attempt: RunAttempt,
    entry: ControlPlaneEntry,
  ): Promise<JournalEntry>;
}
