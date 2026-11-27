import type { ReactElement } from 'react';

import { formatStation, type StationNames } from '@/lib/insights';

type StationGroupNameProps = {
  stationId: string;
  names: StationNames;
};

export function StationGroupName({
  stationId,
  names,
}: StationGroupNameProps): ReactElement {
  const line = names.get(stationId)?.lineName;

  return (
    <p className="flex min-w-0 items-baseline gap-2">
      <span className="truncate font-medium text-foreground">
        {formatStation(names, stationId)}
      </span>
      {line !== undefined && line !== '' && (
        <span className="text-muted-foreground">{line}</span>
      )}
    </p>
  );
}
