import type { PeriodDto } from '@outcomes/application/dto/insights.dto';
import type { MeasureVerdict } from '@outcomes/domain/services/change-verdict';
import type { RunTally } from '@outcomes/domain/services/run-tally';

export interface FlaggedMemoryDto {
  readonly memoryId: string;
  readonly handle: string;
  readonly body: string;
  readonly reason: string | null;
  readonly by: string | null;
  readonly byName: string | null;
  readonly at: string;
}

export interface MemoryBenchmarkDto {
  readonly ranAt: string;
  readonly withMemories: number;
  readonly withoutMemories: number;
  readonly cases: number;
}

export interface InsightsMemoryDto {
  readonly period: PeriodDto;
  readonly truncated: boolean;
  readonly standing: number;
  readonly memoriesBriefed: number;
  readonly memoriesRecalled: number;
  readonly runsBriefed: number;
  readonly runsRecalled: number;
  readonly flagged: readonly FlaggedMemoryDto[];
  readonly withMemories: RunTally;
  readonly withoutMemories: RunTally;
  readonly verdicts: readonly MeasureVerdict[];
  readonly benchmark: MemoryBenchmarkDto | null;
}
