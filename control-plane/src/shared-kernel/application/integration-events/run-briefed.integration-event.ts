export const RUN_BRIEFED = 'work.run-briefed.v1';

export type RunBriefedIntegrationEvent = {
  readonly kind: typeof RUN_BRIEFED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly memories: readonly string[];
};
