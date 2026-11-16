import type { HoldVerdictPublished } from '@shared-kernel/application/integration-events/task-held.integration-event';

export const LINE_RESUMED = 'work.line-resumed.v1';

type HoldEndPublished = 'continue' | 'move-on' | 'finish';

type CheckoutHeadPublished = {
  readonly path: string;
  readonly commit: string;
};

export type LineResumedIntegrationEvent = {
  readonly kind: typeof LINE_RESUMED;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly holdId: string;
  readonly stationId: string;
  readonly by: string;
  readonly fromRunId: string | null;
  readonly verdict: HoldVerdictPublished;
  readonly end: HoldEndPublished;
  readonly turnRunIds: readonly string[];
  readonly fromHeads: readonly CheckoutHeadPublished[];
  readonly toHeads: readonly CheckoutHeadPublished[];
  readonly startedAt: string;
  readonly endedAt: string;
};
