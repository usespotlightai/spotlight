import { asPeriod, DEFAULT_PERIOD, type InsightsPeriod } from '@/lib/insights';
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
  { id: 'config', label: 'Config' },
  { id: 'activity', label: 'Activity' },
  { id: 'judge', label: 'Judge' },
] as const;

export const stationTabsOf = (station: { judge: unknown }) =>
  STATION_TABS.filter((tab) => tab.id !== 'judge' || station.judge !== null);

export type StationTab = (typeof STATION_TABS)[number]['id'];

export const DEFAULT_STATION_TAB: StationTab = STATION_TABS[0].id;

export const stationTab = (tab: string | undefined): StationTab | null =>
  tab === undefined
    ? DEFAULT_STATION_TAB
    : (STATION_TABS.find((each) => each.id === tab)?.id ?? null);

export const stationTabPath = (
  slug: string,
  teamId: string,
  lineId: string,
  stationId: string,
  tab: StationTab,
): string => {
  const at = stationPath(slug, teamId, lineId, stationId);

  return tab === DEFAULT_STATION_TAB ? at : `${at}/${tab}`;
};

export const JUDGE_ANCHOR = 'judge';

export const judgeAgreementPath = (
  slug: string,
  teamId: string,
  station: { lineId: string; stationId: string },
): string =>
  stationTabPath(slug, teamId, station.lineId, station.stationId, 'judge');

export const LIVE_CONFIG = 'live';

export type ActivityPeriod = InsightsPeriod | typeof LIVE_CONFIG;

export const activityPeriodOf = (params: URLSearchParams): ActivityPeriod => {
  const raw = params.get('period');

  return raw === null ? LIVE_CONFIG : asPeriod(raw);
};

export const comparedPeriodOf = (period: ActivityPeriod): InsightsPeriod =>
  period === LIVE_CONFIG ? DEFAULT_PERIOD : period;

export const stationActivityPath = (
  slug: string,
  teamId: string,
  station: { lineId: string; stationId: string },
  period: ActivityPeriod,
): string => {
  const at = stationTabPath(
    slug,
    teamId,
    station.lineId,
    station.stationId,
    'activity',
  );

  return period === LIVE_CONFIG ? at : `${at}?period=${period}`;
};
