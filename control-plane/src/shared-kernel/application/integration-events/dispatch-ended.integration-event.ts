export const DISPATCH_ENDED = 'work.dispatch-ended.v1';

export type DispatchOutcomePublished =
  | 'completed'
  | 'failed'
  | 'exhausted'
  | 'cancelled';

export type DispatchEndedIntegrationEvent = {
  readonly kind: typeof DISPATCH_ENDED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly taskId: string | null;
  readonly stationId: string | null;
  readonly outcome: DispatchOutcomePublished;
  readonly failure: string | null;
  readonly stopped: boolean;
  readonly asked: boolean;
};
