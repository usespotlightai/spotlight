import type { NestedHeading } from '@/lib/nested-table';

export const HOST_HEADINGS: readonly NestedHeading[] = [
  { label: 'Name', size: 'minmax(0,1fr)' },
  { label: 'Serves', size: 'minmax(0,1fr)' },
  { label: 'Status', size: '10rem' },
  { label: 'Images', size: 'minmax(0,1.5fr)' },
  { label: 'Harnesses', size: '5.5rem' },
  { label: 'Release', size: '6rem' },
  { label: 'Last activity', size: '7.5rem', numeric: true },
];

export const HOST_COLUMNS = 'grid-cols-[var(--host-columns)]';

export const HOST_ROW = 'grid h-9 items-center gap-x-6 rounded-md px-3 text-sm';

export const HOST_ROW_HOVER = 'transition-colors hover:bg-accent';

export const COMPACT_PILL = 'px-2 py-0.5 font-normal';
