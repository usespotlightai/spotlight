import type { AssistHarness } from '@assist/domain/aggregates/assist-session.aggregate';
import type { AssistPurpose } from '@assist/domain/value-objects/assist-purpose.vo';
import type { AssistSessionId } from '@assist/domain/value-objects/assist-session-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNS = Symbol('ASSIST_RUNS');

export const ASSIST_OWNER = 'assist';

export interface AssistRunOrder {
  readonly run: RunId;
  readonly session: AssistSessionId;
  readonly workspaceId: WorkspaceId;
  readonly purpose: AssistPurpose;
  readonly basedOn: RunId;
  readonly briefing: string;
  readonly files: Readonly<Record<string, string>>;
}

export type AssistRunEnqueueing =
  | { readonly outcome: 'enqueued'; readonly on: AssistHarness }
  | { readonly outcome: 'no-harness' }
  | { readonly outcome: 'base-run-elsewhere' }
  | { readonly outcome: 'refused' };

export interface RunsPort {
  /** Queues the session's run on the harness, model, effort, placement and restorable archive of its base run. */
  enqueue(order: AssistRunOrder): Promise<AssistRunEnqueueing>;

  isLeasedBy(run: RunId, runnerId: string): Promise<boolean>;
}
