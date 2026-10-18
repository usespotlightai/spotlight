import { cn } from '@/lib/utils';

const LEGEND = [
  { name: 'Traces', swatch: 'bg-primary' },
  { name: 'Errors', swatch: 'bg-destructive' },
] as const;

export function TraceLegend() {
  return (
    <div className="flex items-center justify-end gap-3 pr-2 pb-1">
      {LEGEND.map((each) => (
        <span
          key={each.name}
          className="flex items-center gap-1.5 text-muted-foreground text-xs"
        >
          <span
            className={cn('size-2 rounded-full', each.swatch)}
            aria-hidden
          />
          {each.name}
        </span>
      ))}
    </div>
  );
}
