import type { StationAlertCrossingResponseDto } from '@/lib/api';
import { amountIn } from '@/lib/inbox';
import {
  insightsPath,
  periodCovering,
  shareShown,
  stationAnchor,
} from '@/lib/insights';
import { alertPhrase } from '@/lib/station-watch';

export type StationAlertCrossing = StationAlertCrossingResponseDto;

export type AlertPoint = StationAlertCrossing['series'][number];

type Measure = StationAlertCrossing['threshold']['measure'];

export const measureValueShown = (
  measure: Measure,
  value: number | null,
  currency: string | null,
): string => {
  if (value === null) {
    return '–';
  }

  return measure === 'cost_per_run'
    ? amountIn(value, currency)
    : shareShown(value);
};

const runsShown = (over: number): string =>
  over === 1 ? 'the last run' : `the last ${over} runs`;

const beforeShown = (over: number): string =>
  over === 1 ? 'the one before' : `the ${over} before`;

export const thresholdShown = (alert: StationAlertCrossing): string =>
  alertPhrase(alert.threshold, alert.currency);

export const crossingShown = (alert: StationAlertCrossing): string => {
  const { measure, over } = alert.threshold;
  const now = measureValueShown(measure, alert.value, alert.currency);

  return alert.baseline === null
    ? `It was ${now} across ${runsShown(over)}.`
    : `It was ${now} in ${runsShown(over)}, against ${measureValueShown(measure, alert.baseline, alert.currency)} in ${beforeShown(over)}.`;
};

export const thresholdLine = (alert: StationAlertCrossing): number | null =>
  alert.threshold.above ?? alert.threshold.below ?? null;

export const alertOnInsightsPath = (
  slug: string,
  teamId: string,
  alert: StationAlertCrossing,
  now: Date,
): string =>
  `${insightsPath(slug, teamId, {
    tab: 'stations',
    period: periodCovering(alert.raisedAt, now),
    filter: {},
    page: 1,
  })}#${stationAnchor(alert.stationId)}`;
