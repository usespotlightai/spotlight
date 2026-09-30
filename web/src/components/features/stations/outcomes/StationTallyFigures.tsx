import { type StationTally, tallyFigures } from '@/lib/station-outcomes';

export function StationTallyFigures({ tally }: { tally: StationTally }) {
  return (
    <dl
      data-slot="station-tally"
      className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs"
    >
      {tallyFigures(tally).map((figure) => (
        <div key={figure.label} className="flex items-center gap-1">
          <dt className="text-muted-foreground">{figure.label}</dt>
          <dd className="text-foreground tabular-nums">{figure.value}</dd>
        </div>
      ))}
    </dl>
  );
}
