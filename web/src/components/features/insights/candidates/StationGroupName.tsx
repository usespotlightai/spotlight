import { type StationNames, stationShown } from '@/lib/insights';

type StationGroupNameProps = {
  stationId: string;
  names: StationNames;
};

export function StationGroupName({ stationId, names }: StationGroupNameProps) {
  const line = names.get(stationId)?.lineName;

  return (
    <p className="flex min-w-0 items-baseline gap-2 text-xs">
      <span className="truncate font-medium text-foreground">
        {stationShown(names, stationId)}
      </span>
      {line && <span className="text-muted-foreground">{line}</span>}
    </p>
  );
}
