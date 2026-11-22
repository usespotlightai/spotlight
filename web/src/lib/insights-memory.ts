import type {
  CutMemoryResponseDto,
  FlaggedMemoryResponseDto,
  InsightsMemoryResponseDto,
} from '@/lib/api';
import { formatCount } from '@/lib/insights';
import { FIGURE, type NestedHeading } from '@/lib/nested-table';

export type InsightsMemory = InsightsMemoryResponseDto;
export type FlaggedMemory = FlaggedMemoryResponseDto;
export type CutMemory = CutMemoryResponseDto;

export type MemoryTile = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
};

const runs = (count: number): string =>
  `${formatCount(count)} ${count === 1 ? 'run' : 'runs'}`;

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
    id: 'read',
    label: 'Read',
    value: formatCount(memory.memoriesRead),
    detail: `From the memory folder in ${runs(memory.runsRead)}`,
  },
  {
    id: 'recalled',
    label: 'Recalled',
    value: formatCount(memory.memoriesRecalled),
    detail: `With spotlight recall in ${runs(memory.runsRecalled)}`,
  },
  {
    id: 'delivered',
    label: 'Delivered',
    value: formatCount(memory.memoriesDelivered),
    detail: `At a path they are about in ${runs(memory.runsDelivered)}`,
  },
];

export const usedNoMemory = (memory: InsightsMemory): boolean =>
  memory.activeCount === 0 &&
  memory.memoriesBriefed === 0 &&
  memory.memoriesRead === 0 &&
  memory.memoriesRecalled === 0 &&
  memory.memoriesDelivered === 0 &&
  memory.flagged.length === 0;

export const FLAGGED_NOTE =
  'Memories that people retired as wrong in this period. Replaced memories don’t count.';

export const cutNote = (memory: InsightsMemory): string =>
  `Memories the cap left out of a brief that the run then read, recalled or was given. This happened in ${runs(memory.runsCutThenRead)}. A memory here may need a better rank.`;

export const CUT_HEADINGS: readonly NestedHeading[] = [
  { label: 'Memory', indent: 'edge', size: 'minmax(16rem,1fr)' },
  { label: 'Runs', numeric: true, size: FIGURE },
];

export const MEMORY_COMPARISON_TITLE = 'Runs that used memories and other runs';

export const MEMORY_COMPARISON_NOTE =
  'Runs that got a memory in their brief, read one or were given one, against the other runs in this period. A difference shows a link, not a cause.';

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
