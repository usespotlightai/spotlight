import { DEFAULT_PERIOD, insightsPath } from '@/lib/insights';
import { linePath } from '@/lib/team';

export const stationPath = (
  slug: string,
  teamId: string,
  lineId: string,
  stationId: string,
): string => `${linePath(slug, teamId, lineId)}/stations/${stationId}`;

export const stationShare = (place: number, count: number): number =>
  count > 1 ? place / (count - 1) : 1;

export const STATION_TABS = [{ id: 'overview', label: 'Overview' }] as const;

export type StationTab = (typeof STATION_TABS)[number]['id'];

export const JUDGE_ANCHOR = 'judge';

export const stationInsightsPath = (
  slug: string,
  teamId: string,
  stationId: string,
): string =>
  insightsPath(slug, teamId, {
    tab: 'stations',
    period: DEFAULT_PERIOD,
    filter: { stationId },
    page: 1,
  });

export const judgeAgreementPath = (
  slug: string,
  teamId: string,
  station: { stationId: string },
): string =>
  `${stationInsightsPath(slug, teamId, station.stationId)}#${JUDGE_ANCHOR}`;
