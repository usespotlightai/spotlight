export const TEAM_MEMORY_USE = Symbol('TEAM_MEMORY_USE');

export interface MemoryUseWindow {
  readonly workspaceId: string;
  readonly teamId: string;
  readonly from: Date;
  readonly to: Date;
}

interface FlaggedMemory {
  readonly memoryId: string;
  readonly handle: string;
  readonly body: string;
  readonly reason: string | null;
  readonly by: string | null;
  readonly at: Date;
}

export interface TeamMemoryUse {
  readonly activeCount: number;
  readonly flagged: readonly FlaggedMemory[];
}

export interface TeamMemoryUsePort {
  between(window: MemoryUseWindow): Promise<TeamMemoryUse>;
}
