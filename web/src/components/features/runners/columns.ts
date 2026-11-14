import type { NestedHeading } from '@/lib/nested-table';

const NAME: NestedHeading = { label: 'Name', size: 'minmax(0,1fr)' };
const SERVES: NestedHeading = { label: 'Serves', size: 'minmax(0,1fr)' };
const LAST_ACTIVITY: NestedHeading = {
  label: 'Last activity',
  size: '8.5rem',
  numeric: true,
};

export const HOST_HEADINGS: readonly NestedHeading[] = [
  NAME,
  SERVES,
  { label: 'Status', size: '8.5rem' },
  { label: 'Slots', size: '4.5rem' },
  { label: 'Images', size: 'minmax(10rem,1.75fr)' },
  { label: 'Harnesses', size: '5.5rem' },
  { label: 'Release', size: '6rem' },
  LAST_ACTIVITY,
];

export const NARROW_HEADINGS: readonly NestedHeading[] = [
  NAME,
  SERVES,
  { label: 'Status', size: '7.5rem' },
  LAST_ACTIVITY,
];

const NARROW_COLUMNS = [0, 1, 2, 7];

export const narrowOf = <T>(columns: readonly T[]): T[] =>
  NARROW_COLUMNS.map((column) => columns[column]);

export const HOST_COLUMNS =
  'grid-cols-[minmax(0,1fr)_min(8.5rem,45%)] @xl/pane:grid-cols-[var(--host-columns-narrow)] @5xl/pane:grid-cols-[var(--host-columns)]';

const STICKY_NAME =
  '[&>:first-child]:sticky [&>:first-child]:left-0 [&>:first-child]:z-10 @5xl/pane:[&>:first-child]:-mr-6 [&>:first-child]:-ml-9 [&>:first-child]:border-transparent @5xl/pane:[&>:first-child]:border-r-[1.5rem] [&>:first-child]:border-l-[2.25rem] [&>:first-child]:rounded-l-md [&>:first-child]:bg-inherit';

const WIDE_CELLS =
  '@max-5xl/pane:not-data-[slot=runner-row]:[&>:nth-child(n+4):nth-child(-n+7)]:hidden @max-5xl/pane:data-[slot=runner-row]:[&>:nth-child(n+3):nth-child(-n+6)]:hidden';

export const HOST_HEAD = `hidden h-8 items-center gap-x-6 bg-surface pr-3 pl-9 text-muted-foreground text-xs @xl/pane:grid ${STICKY_NAME} ${WIDE_CELLS}`;

export const HOST_ROW = `relative grid grid-flow-col grid-rows-2 items-center gap-x-6 gap-y-0.5 rounded-md bg-surface py-1.5 pr-3 pl-9 text-sm @xl/pane:h-9 @xl/pane:grid-flow-row @xl/pane:grid-rows-none @xl/pane:py-0 ${STICKY_NAME} ${WIDE_CELLS}`;

export const HOST_ROW_HOVER = 'transition-colors hover:bg-accent';

export const COMPACT_PILL = 'px-2 py-0.5 font-normal';
