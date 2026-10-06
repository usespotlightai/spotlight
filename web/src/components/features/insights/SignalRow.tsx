import { SignalDumbbell } from '@/components/features/insights/SignalDumbbell';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
} from '@/components/shared/nested-table/nested-rows';
import {
  type SignalReading,
  signalLabel,
  signalShown,
  signalValue,
} from '@/lib/insights';
import { cn } from '@/lib/utils';

const COMPARED = [
  { id: 'now', heading: 'This period' },
  { id: 'before', heading: 'Period before' },
  { id: 'team', heading: 'All stations' },
  { id: 'flaggedAbove', heading: 'Flagged above' },
] as const;

export function SignalRow({ reading }: { reading: SignalReading }) {
  return (
    <li
      role="img"
      aria-label={signalShown(reading)}
      data-slot="signal-reading"
      className={cn(
        'relative col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2 pr-2 text-xs @4xl:grid-cols-subgrid',
        OUTER_GUIDE,
        OUTER_DIVIDER,
      )}
    >
      <span
        className={cn(
          'col-span-full min-w-0 truncate text-foreground @4xl:col-span-1',
          OUTER_INDENT,
        )}
      >
        {signalLabel(reading.signal)}
      </span>

      <div className="col-span-full min-w-0 @4xl:col-span-1">
        <SignalDumbbell reading={reading} />
      </div>

      {COMPARED.map(({ id, heading }) => (
        <NestedCell key={id} heading={heading} strong={id === 'now'}>
          {signalValue(reading, reading[id])}
        </NestedCell>
      ))}
    </li>
  );
}
