import type { RunRequesterPublished } from '@shared-kernel/application/integration-events/requested-run-ended.integration-event';

export const REQUESTED_RUN_SUSPENDED = 'runs.run-suspended.v1';

export type RequestedRunSuspendedIntegrationEvent = {
  readonly kind: typeof REQUESTED_RUN_SUSPENDED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly requester: RunRequesterPublished;
  readonly attempt: number;
  readonly at: string;
};
