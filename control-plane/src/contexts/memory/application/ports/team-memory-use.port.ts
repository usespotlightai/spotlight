export const TEAM_MEMORY_USE = Symbol('TEAM_MEMORY_USE');

export interface MemoryUseWindow {
  readonly workspaceId: string;
  readonly teamId: string;
  readonly from: Date;
  readonly to: Date;
  readonly runIds: readonly string[];
}

interface FlaggedMemory {
  readonly memoryId: string;
  readonly handle: string;
  readonly body: string;
  readonly reason: string | null;
  readonly by: string | null;
  readonly at: Date;
}

interface RunMemoryUse {
  readonly runId: string;
  readonly briefed: number;
  readonly recalled: number;
}

export interface TeamMemoryUse {
  readonly standing: number;
  readonly memoriesBriefed: number;
  readonly memoriesRecalled: number;
  readonly flagged: readonly FlaggedMemory[];
  readonly runs: readonly RunMemoryUse[];
}

export interface TeamMemoryUsePort {
  between(window: MemoryUseWindow): Promise<TeamMemoryUse>;
}
