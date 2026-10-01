import type {
  FlaggedMemoryResponseDto,
  InsightsMemoryResponseDto,
  MemoryBenchmarkResponseDto,
} from '@/lib/api';
import { countShown, shareShown } from '@/lib/insights';

export type InsightsMemory = InsightsMemoryResponseDto;
export type FlaggedMemory = FlaggedMemoryResponseDto;
export type MemoryBenchmark = MemoryBenchmarkResponseDto;

export type MemoryTile = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
};

const runs = (count: number): string =>
  `${countShown(count)} ${count === 1 ? 'run' : 'runs'}`;

export const memoryTiles = (memory: InsightsMemory): MemoryTile[] => [
  {
    id: 'standing',
    label: 'Standing memories',
    value: countShown(memory.standing),
    detail: 'Kept by the team now',
  },
  {
    id: 'briefed',
    label: 'Briefed',
    value: countShown(memory.memoriesBriefed),
    detail: `to ${runs(memory.runsBriefed)}`,
  },
  {
    id: 'read',
    label: 'Read',
    value: countShown(memory.memoriesRecalled),
    detail: `by ${runs(memory.runsRecalled)}`,
  },
  {
    id: 'flagged',
    label: 'Flagged wrong',
    value: countShown(memory.flagged.length),
    detail: 'Retired by people this period',
  },
];

export const usedNoMemory = (memory: InsightsMemory): boolean =>
  memory.standing === 0 &&
  memory.memoriesBriefed === 0 &&
  memory.memoriesRecalled === 0 &&
  memory.flagged.length === 0;

export const benchmarkShown = (benchmark: MemoryBenchmark): string =>
  `${shareShown(benchmark.withMemories)} solved with memories, ${shareShown(benchmark.withoutMemories)} without, over ${countShown(benchmark.cases)} cases`;
