import type { TeamWindow } from '@outcomes/domain/repositories/run-record.repository';
import type { MemoryUseOfRun } from '@outcomes/domain/services/memory-comparison';

export const MEMORY_USE = Symbol('OUTCOMES_MEMORY_USE');

interface FlaggedMemoryView {
  readonly memoryId: string;
  readonly handle: string;
  readonly body: string;
  readonly reason: string | null;
  readonly by: string | null;
  readonly at: Date;
}

export interface TeamMemoryUseView {
  readonly standing: number;
  readonly memoriesBriefed: number;
  readonly memoriesRecalled: number;
  readonly flagged: readonly FlaggedMemoryView[];
  readonly runs: readonly MemoryUseOfRun[];
}

export interface MemoryUsePort {
  between(
    window: TeamWindow,
    runIds: readonly string[],
  ): Promise<TeamMemoryUseView>;
}
