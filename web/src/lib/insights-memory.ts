import type {
  FlaggedMemoryResponseDto,
  InsightsMemoryResponseDto,
  MemoryBenchmarkResponseDto,
} from '@/lib/api';
import { formatCount, formatShare } from '@/lib/insights';
import { formatDay } from '@/lib/judge';
import { FIGURE, type NestedHeading } from '@/lib/nested-table';

export type InsightsMemory = InsightsMemoryResponseDto;
export type FlaggedMemory = FlaggedMemoryResponseDto;
type MemoryBenchmark = MemoryBenchmarkResponseDto;

export type MemoryTile = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly tooltip?: string;
};

const runs = (count: number): string =>
  `${formatCount(count)} ${count === 1 ? 'run' : 'runs'}`;

const benchmarkTile = (benchmark: MemoryBenchmark | null): MemoryTile =>
  benchmark
    ? {
        id: 'benchmark',
        label: 'Solved with memories',
        value: formatShare(benchmark.withMemories),
        detail: `${formatShare(benchmark.withoutMemories)} without them, ${formatDay(benchmark.ranAt.slice(0, 10))}`,
        tooltip: `A benchmark of ${formatCount(benchmark.cases)} cases, run on ${formatDay(benchmark.ranAt.slice(0, 10))}, solved with the team’s memories and without them.`,
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
    detail: 'Approved by the team',
  },
  {
    id: 'briefed',
    label: 'Briefed',
    value: formatCount(memory.memoriesBriefed),
    detail: `In the briefs of ${runs(memory.runsBriefed)}`,
  },
  {
    id: 'recalled',
    label: 'Recalled',
    value: formatCount(memory.memoriesRecalled),
    detail: `Read in ${runs(memory.runsRecalled)}`,
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

export const MEMORY_COMPARISON_TITLE = 'Runs that used memories and other runs';

export const MEMORY_COMPARISON_NOTE =
  'Runs that got a memory in their brief or read one, against the other runs in this period. A difference shows a link, not a cause.';

export const FLAGGED_HEADINGS: readonly NestedHeading[] = [
  { label: 'Memory', indent: 'edge', size: 'minmax(16rem,3fr)' },
  { label: 'Reason', size: 'minmax(14rem,2fr)' },
  { label: 'Flagged by', size: 'minmax(8rem,max-content)' },
  { label: 'Date', numeric: true, size: FIGURE },
];

export const MEMORY_COMPARISON_HEADINGS: readonly NestedHeading[] = [
  { label: 'Measure', indent: 'edge', size: 'minmax(12rem,1fr)' },
  { label: 'Without', numeric: true, size: FIGURE },
  { label: 'With', numeric: true, size: FIGURE },
  { label: 'Change', numeric: true, size: 'minmax(7rem,max-content)' },
];
