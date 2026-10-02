import type { RunEnding } from '@shared-kernel/application/integration-events/run-ended.integration-event';

export const REPLAY_ENDED = 'work.replay-ended.v1';

export type ReplayEndedIntegrationEvent = {
  readonly kind: typeof REPLAY_ENDED;
  readonly runId: string;
  readonly replayOf: string;
  readonly workspaceId: string;
  readonly outcome: RunEnding;
  readonly failure: string | null;
  readonly stopped: boolean;
  readonly asked: boolean;
  readonly next: string | null;
  readonly note: string | null;
};
