import { TABLE_HEAD } from '@/components/shared/table-rows';
import { cn } from '@/lib/utils';

export const RECENT_RUN_COLUMNS =
  'grid-cols-[minmax(7rem,1.2fr)_3rem_minmax(7rem,1fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_5rem_4.5rem_4.5rem]';

const HEADINGS = [
  ['Run', false],
  ['Visit', false],
  ['Checks', false],
  ['Human action', false],
  ['Pull request', false],
  ['Duration', true],
  ['Cost', true],
  ['Ended', true],
] as const;

export function RecentRunsHead() {
  return (
    <div aria-hidden className={cn(TABLE_HEAD, RECENT_RUN_COLUMNS)}>
      {HEADINGS.map(([heading, numeric]) => (
        <span key={heading} className={cn('truncate', numeric && 'text-right')}>
          {heading}
        </span>
      ))}
    </div>
  );
}
