export const DISPATCH_SUPERSEDED = 'work.dispatch-superseded.v1';

export type DispatchSupersededIntegrationEvent = {
  readonly kind: typeof DISPATCH_SUPERSEDED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly taskId: string | null;
  readonly at: string;
};
