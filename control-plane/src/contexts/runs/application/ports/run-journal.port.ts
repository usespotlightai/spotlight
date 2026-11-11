import type { HookCallTrace } from '@runs/application/ports/hook-traces.port';
import type {
  HOOK_CALLED,
  PROVISION_FAILED,
  RUN_PAUSED,
} from '@runs/domain/value-objects/journal-entry-type';
import type { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';

export const RUN_JOURNAL = Symbol('RUN_JOURNAL');

export interface JournalEntry {
  readonly seq: number;
  readonly type: string;
  readonly at: Date;
  readonly message?: string;
  readonly data?: string;
}

interface HookCalledFacts {
  readonly type: typeof HOOK_CALLED;
  readonly call: HookCallTrace;
}

interface ProvisionFailedFacts {
  readonly type: typeof PROVISION_FAILED;
  readonly failure: string;
  readonly detail: string;
}

interface RunPausedFacts {
  readonly type: typeof RUN_PAUSED;
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
