import type { RunEnding } from '@shared-kernel/application/integration-events/run-ended.integration-event';

export const SEARCH_RUN_ENDED = 'work.search-run-ended.v1';

export type SearchRunEndedIntegrationEvent = {
  readonly kind: typeof SEARCH_RUN_ENDED;
  readonly runId: string;
  readonly searchId: string;
  readonly iteration: number;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly stationId: string | null;
  readonly outcome: RunEnding;
  readonly failure: string | null;
  readonly asked: boolean;
  readonly stopped: boolean;
  readonly started: boolean;
  readonly endedAt: string;
};
