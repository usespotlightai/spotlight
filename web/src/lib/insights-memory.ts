import type {
  FlaggedMemoryResponseDto,
  InsightsMemoryResponseDto,
  MemoryBenchmarkResponseDto,
} from '@/lib/api';
import { formatCount, formatShare } from '@/lib/insights';
import { formatDay } from '@/lib/judge';

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
  `${formatCount(count)} ${count === 1 ? 'run' : 'runs'}`;

const benchmarkTile = (benchmark: MemoryBenchmark | null): MemoryTile =>
  benchmark
    ? {
        id: 'benchmark',
        label: 'Solved with memories',
        value: formatShare(benchmark.withMemories),
        detail: `${formatShare(benchmark.withoutMemories)} without, ${formatCount(benchmark.cases)} cases, ${formatDay(benchmark.ranAt.slice(0, 10))}`,
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
    value: formatCount(memory.standing),
    detail: 'Kept by the team now',
  },
  {
    id: 'briefed',
    label: 'Briefed',
    value: formatCount(memory.memoriesBriefed),
    detail: `to ${runs(memory.runsBriefed)}`,
  },
  {
    id: 'read',
    label: 'Read',
    value: formatCount(memory.memoriesRecalled),
    detail: `by ${runs(memory.runsRecalled)}`,
  },
  {
    id: 'flagged',
    label: 'Flagged wrong',
    value: formatCount(memory.flagged.length),
    detail: 'Retired by people in this period',
  },
  benchmarkTile(memory.benchmark),
];

export const usedNoMemory = (memory: InsightsMemory): boolean =>
  memory.standing === 0 &&
  memory.memoriesBriefed === 0 &&
  memory.memoriesRecalled === 0 &&
  memory.flagged.length === 0;
