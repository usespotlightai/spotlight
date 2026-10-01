import { linePath } from '@/lib/team';

export const stationPath = (
  slug: string,
  teamId: string,
  lineId: string,
  stationId: string,
): string => `${linePath(slug, teamId, lineId)}/stations/${stationId}`;

export const stationShare = (place: number, count: number): number =>
  count > 1 ? place / (count - 1) : 1;

export const JUDGE_ANCHOR = 'judge';

export const judgeAgreementPath = (
  slug: string,
  teamId: string,
  station: { lineId: string; stationId: string },
): string =>
  `${stationPath(slug, teamId, station.lineId, station.stationId)}#${JUDGE_ANCHOR}`;
