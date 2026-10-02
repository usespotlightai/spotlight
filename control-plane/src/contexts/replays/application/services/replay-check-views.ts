import type { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';

export const replayUrlOf = (
  origin: string,
  slug: string | null,
  check: ReplayCheck,
): string | null =>
  slug &&
  `${origin.replace(/\/+$/, '')}/w/${slug}/team/${check.teamId.value}/lines/${check.station.lineId}/stations/${check.station.stationId}/replays/${check.replayId.value}`;
