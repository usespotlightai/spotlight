import { SignalDumbbell } from '@/components/features/insights/SignalDumbbell';
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
      className="col-span-full grid grid-cols-2 items-center sm:grid-cols-4 gap-x-6 gap-y-1 text-xs leading-4 md:grid-cols-subgrid"
    >
      <span className="col-span-full text-muted-foreground md:col-span-1 md:whitespace-nowrap">
        {signalLabel(reading.signal)}
      </span>

      <div className="col-span-full min-w-0 md:col-span-1">
        <SignalDumbbell reading={reading} />
      </div>

      {COMPARED.map(({ id, heading }) => (
        <span
          key={id}
          className="flex flex-col tabular-nums md:block md:text-right"
        >
          <span className="text-[0.7rem] text-muted-foreground md:hidden">
            {heading}
          </span>
          <span
            className={cn(
              id === 'now'
                ? 'font-medium text-foreground'
                : 'text-muted-foreground',
            )}
          >
            {signalValue(reading, reading[id])}
          </span>
        </span>
      ))}
    </li>
  );
}
