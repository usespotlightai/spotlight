import type { RunEnding } from '@shared-kernel/application/integration-events/run-ended.integration-event';

export const REQUESTED_RUN_ENDED = 'work.requested-run-ended.v1';

export type RequestedRunEnding = 'completed' | 'exhausted' | 'cancelled';

export type RequestedRunEndedIntegrationEvent = {
  readonly kind: typeof REQUESTED_RUN_ENDED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly requester: {
    readonly owner: string;
    readonly kind: string;
    readonly id: string;
    readonly token: string | null;
    readonly team: string | null;
  };
  readonly attempt: number;
  readonly ending: RequestedRunEnding;
  readonly outcome: RunEnding;
  readonly failure: string | null;
  readonly stopped: boolean;
  readonly started: boolean;
  readonly askedAPerson: boolean;
  readonly handsOver: boolean;
  readonly report: {
    readonly next: string | null;
    readonly note: string | null;
  } | null;
  readonly endedAt: string;
};
