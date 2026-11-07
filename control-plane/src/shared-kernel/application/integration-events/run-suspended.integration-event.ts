import type { RunRequesterPublished } from '@shared-kernel/application/integration-events/run-ended.integration-event';

export const RUN_SUSPENDED = 'runs.run-suspended.v1';

export type RunSuspendedIntegrationEvent = {
  readonly kind: typeof RUN_SUSPENDED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly requester: RunRequesterPublished;
  readonly attempt: number;
  readonly at: string;
};
