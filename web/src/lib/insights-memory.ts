import type {
  FlaggedMemoryResponseDto,
  InsightsMemoryResponseDto,
  MemoryBenchmarkResponseDto,
} from '@/lib/api';
import { countShown, shareShown } from '@/lib/insights';
import { dayShown } from '@/lib/judge';

export type InsightsMemory = InsightsMemoryResponseDto;
export type FlaggedMemory = FlaggedMemoryResponseDto;
type MemoryBenchmark = MemoryBenchmarkResponseDto;

export type MemoryTile = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
};

const runs = (count: number): string =>
  `${countShown(count)} ${count === 1 ? 'run' : 'runs'}`;

const benchmarkTile = (benchmark: MemoryBenchmark | null): MemoryTile =>
  benchmark
    ? {
        id: 'benchmark',
        label: 'Solved with memories',
        value: shareShown(benchmark.withMemories),
        detail: `${shareShown(benchmark.withoutMemories)} without, ${countShown(benchmark.cases)} cases, ${dayShown(benchmark.ranAt.slice(0, 10))}`,
      }
    : {
        id: 'benchmark',
        label: 'Solved with memories',
        value: '–',
        detail: 'No benchmark yet',
      };

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
  benchmarkTile(memory.benchmark),
];

export const usedNoMemory = (memory: InsightsMemory): boolean =>
  memory.standing === 0 &&
  memory.memoriesBriefed === 0 &&
  memory.memoriesRecalled === 0 &&
  memory.flagged.length === 0;
