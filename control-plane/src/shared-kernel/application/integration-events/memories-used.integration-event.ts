export const MEMORIES_USED = 'memory.memories-used.v1';

export type MemoriesUsedIntegrationEvent = {
  readonly kind: typeof MEMORIES_USED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly taskId: string | null;
  readonly via: 'briefed' | 'recalled';
  readonly memories: readonly string[];
};
