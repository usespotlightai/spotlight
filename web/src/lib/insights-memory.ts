import type {
  FlaggedMemoryResponseDto,
  InsightsMemoryResponseDto,
  MemoryBenchmarkResponseDto,
} from '@/lib/api';
import { formatCount, formatShare } from '@/lib/insights';
import { formatDay } from '@/lib/judge';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';

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
    id: 'active',
    label: 'Active memories',
    value: formatCount(memory.activeCount),
    detail: 'Approved by the team now',
  },
  {
    id: 'briefed',
    label: 'Briefed',
    value: formatCount(memory.memoriesBriefed),
    detail: `to ${runs(memory.runsBriefed)}`,
  },
  {
    id: 'recalled',
    label: 'Recalled',
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
  memory.activeCount === 0 &&
  memory.memoriesBriefed === 0 &&
  memory.memoriesRecalled === 0 &&
  memory.flagged.length === 0;

export const FLAGGED_NOTE =
  'Memories that people retired as wrong in this period. Replaced memories don’t count.';

export const MEMORY_COMPARISON_NOTE =
  'Outcomes of runs that got a memory in their brief or read one, compared with the other runs in this period.';

export const MEMORY_COMPARISON_HEADINGS: readonly NestedHeading[] = [
  { label: 'Measure', indent: 'edge', size: SPREAD },
  { label: 'Without', numeric: true, size: SPREAD },
  { label: 'With', numeric: true, size: SPREAD },
  { label: 'Change', numeric: true, size: SPREAD },
];

export const FLAGGED_HEADINGS: readonly NestedHeading[] = [
  { label: 'Memory', indent: 'edge', size: 'minmax(16rem,3fr)' },
  { label: 'Reason', size: 'minmax(12rem,2fr)' },
  { label: 'Flagged by', size: SPREAD },
  { label: 'Date', numeric: true, size: SPREAD },
];
