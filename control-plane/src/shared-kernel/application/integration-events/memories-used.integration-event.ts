/** @public */
export const MEMORIES_USED = 'memory.memories-used.v1';

/** @public */
export type MemoriesUsedIntegrationEvent = {
  readonly kind: typeof MEMORIES_USED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly taskId: string | null;
  readonly via: 'briefed' | 'recalled';
  readonly memories: readonly string[];
};

export const MEMORIES_USED_V2 = 'memory.memories-used.v2';

export type MemoriesUsedV2IntegrationEvent = {
  readonly kind: typeof MEMORIES_USED_V2;
  readonly runId: string;
  readonly workspaceId: string;
  readonly taskId: string | null;
  readonly via: 'briefed' | 'read' | 'recalled' | 'delivered';
  readonly memories: readonly string[];
};
