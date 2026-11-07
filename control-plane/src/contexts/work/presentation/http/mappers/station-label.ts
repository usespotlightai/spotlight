const UNNAMED_STATION = 'Station';

export const stationLabelOf = (name: string | null): string =>
  name ?? UNNAMED_STATION;
