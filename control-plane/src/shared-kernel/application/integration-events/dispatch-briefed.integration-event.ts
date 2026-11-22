/** @public */
export const DISPATCH_BRIEFED = 'work.dispatch-briefed.v1';

/** @public */
export type DispatchBriefedIntegrationEvent = {
  readonly kind: typeof DISPATCH_BRIEFED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly taskId: string | null;
  readonly memories: readonly string[];
  readonly driver: 'line' | 'person';
};

export const DISPATCH_BRIEFED_V2 = 'work.dispatch-briefed.v2';

export type DispatchBriefedV2IntegrationEvent = {
  readonly kind: typeof DISPATCH_BRIEFED_V2;
  readonly runId: string;
  readonly workspaceId: string;
  readonly taskId: string | null;
  readonly memories: readonly string[];
  readonly omitted: readonly string[];
  readonly driver: 'line' | 'person';
};
