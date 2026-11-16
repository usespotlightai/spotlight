import type { TakeoverVerdictPublished } from '@shared-kernel/application/integration-events/task-taken-over.integration-event';

export const TASK_HANDED_BACK = 'work.task-handed-back.v1';

export type HandBackPublished = 'continue' | 'move-on' | 'finish';

export type CheckoutHeadPublished = {
  readonly path: string;
  readonly commit: string;
};

export type TaskHandedBackIntegrationEvent = {
  readonly kind: typeof TASK_HANDED_BACK;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly takeoverId: string;
  readonly stationId: string;
  readonly by: string;
  readonly fromRunId: string | null;
  readonly verdict: TakeoverVerdictPublished;
  readonly handBack: HandBackPublished;
  readonly turnRunIds: readonly string[];
  readonly fromHeads: readonly CheckoutHeadPublished[];
  readonly toHeads: readonly CheckoutHeadPublished[];
  readonly startedAt: string;
  readonly endedAt: string;
};
