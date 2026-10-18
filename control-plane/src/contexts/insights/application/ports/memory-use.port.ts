import type { TeamWindow } from '@insights/domain/repositories/run-record.repository';

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

export interface MemoryUsePort {
  between(window: TeamWindow): Promise<TeamMemoryUseView>;
}
