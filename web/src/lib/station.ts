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

export const STATION_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'improve', label: 'Improve' },
] as const;

export type StationTab = (typeof STATION_TABS)[number]['id'];

export const stationTab = (tab: string | undefined): StationTab | null =>
  tab === undefined
    ? 'overview'
    : (STATION_TABS.find((each) => each.id === tab)?.id ?? null);

export const stationTabPath = (
  slug: string,
  teamId: string,
  lineId: string,
  stationId: string,
  tab: StationTab,
): string => {
  const at = stationPath(slug, teamId, lineId, stationId);

  return tab === 'overview' ? at : `${at}/${tab}`;
};

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
