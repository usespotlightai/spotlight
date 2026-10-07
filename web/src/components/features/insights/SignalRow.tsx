import type { ReactNode } from 'react';
import { SignalDumbbell } from '@/components/features/insights/SignalDumbbell';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  EDGE_INDENT,
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
  ROW_DIVIDER,
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

type SignalRowProps = {
  reading: SignalReading;
  nested?: boolean;
  action?: ReactNode;
};

export function SignalRow({ reading, nested = true, action }: SignalRowProps) {
  const pictured = action
    ? {}
    : { role: 'img' as const, 'aria-label': signalShown(reading) };

  return (
    <li
      {...pictured}
      data-slot="signal-reading"
      className={cn(
        'relative col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2 pr-2 text-xs @4xl:grid-cols-subgrid @lg:group-data-compact/nested:grid-cols-subgrid',
        nested ? [OUTER_GUIDE, OUTER_DIVIDER] : ROW_DIVIDER,
      )}
    >
      <span
        className={cn(
          'col-span-full min-w-0 truncate text-foreground @4xl:col-span-1 @lg:group-data-compact/nested:col-span-1',
          nested ? OUTER_INDENT : EDGE_INDENT,
        )}
      >
        {signalLabel(reading.signal)}
      </span>

      <div
        {...(action
          ? { role: 'img' as const, 'aria-label': signalShown(reading) }
          : {})}
        className="col-span-full min-w-0 @4xl:col-span-1 @lg:group-data-compact/nested:col-span-1"
      >
        <SignalDumbbell reading={reading} />
      </div>

      {COMPARED.map(({ id, heading }) => (
        <NestedCell key={id} heading={heading} strong={id === 'now'}>
          {signalValue(reading, reading[id])}
        </NestedCell>
      ))}

      {action && (
        <span className="col-span-full flex justify-end @4xl:col-span-1 @lg:group-data-compact/nested:col-span-1">
          {action}
        </span>
      )}
    </li>
  );
}
