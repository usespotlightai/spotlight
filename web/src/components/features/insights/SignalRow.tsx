import type { ReactNode } from 'react';
import { SignalDumbbell } from '@/components/features/insights/SignalDumbbell';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  EDGE_INDENT,
  LEAD_CELL,
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import {
  formatSignal,
  type SignalReading,
  signalLabel,
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
    : { role: 'img' as const, 'aria-label': formatSignal(reading) };

  return (
    <li
      {...pictured}
      data-slot="signal-reading"
      className={cn(
        TABLE_ROW,
        nested ? [OUTER_GUIDE, OUTER_DIVIDER] : ROW_DIVIDER,
      )}
    >
      <span
        className={cn(
          LEAD_CELL,
          'text-foreground',
          nested ? OUTER_INDENT : EDGE_INDENT,
        )}
      >
        <span className="truncate">{signalLabel(reading.signal)}</span>
      </span>

      <div
        {...(action
          ? { role: 'img' as const, 'aria-label': formatSignal(reading) }
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
