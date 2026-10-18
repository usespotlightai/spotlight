import { formatStation, type StationNames } from '@/lib/insights';

type StationInsightsHeadingProps = {
  stationId: string;
  names: StationNames;
};

export function StationInsightsHeading({
  stationId,
  names,
}: StationInsightsHeadingProps) {
  const named = names.get(stationId);

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <h2 className="font-semibold text-foreground text-lg tracking-tight">
        {formatStation(names, stationId)}
      </h2>
      {named && (
        <span className="text-muted-foreground text-sm">{named.lineName}</span>
      )}
    </div>
  );
}
