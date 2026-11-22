import type { TeamWindow } from '@insights/application/ports/insights-reader.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const MEMORY_USE = Symbol('INSIGHTS_MEMORY_USE');

interface FlaggedMemoryView {
  readonly memoryId: string;
  readonly handle: string;
  readonly body: string;
  readonly reason: string | null;
  readonly by: string | null;
  readonly at: Date;
}

export interface TeamMemoryUseView {
  readonly activeCount: number;
  readonly flagged: readonly FlaggedMemoryView[];
}

export interface MemoryView {
  readonly memoryId: string;
  readonly handle: string;
  readonly body: string;
}

export interface MemoryUsePort {
  between(window: TeamWindow): Promise<TeamMemoryUseView>;

  described(
    workspaceId: WorkspaceId,
    memories: readonly string[],
  ): Promise<ReadonlyMap<string, MemoryView>>;
}
