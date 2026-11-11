export const DISPATCH_BRIEFED = 'work.dispatch-briefed.v1';

export type DispatchBriefedIntegrationEvent = {
  readonly kind: typeof DISPATCH_BRIEFED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly taskId: string | null;
  readonly memories: readonly string[];
};
