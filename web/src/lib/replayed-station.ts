import type { ReplayedStation } from '@/lib/replay';

type StationParams = {
  readonly slug?: string;
  readonly teamId?: string;
  readonly lineId?: string;
  readonly stationId?: string;
};

export const replayedStationOf = ({
  slug,
  teamId,
  lineId,
  stationId,
}: StationParams): ReplayedStation | null =>
  slug && teamId && lineId && stationId
    ? { slug, teamId, lineId, stationId }
    : null;
