import type { StationAlertCrossingResponseDto } from '@/lib/api';
import { amountIn } from '@/lib/inbox';
import { formatShare, insightsPath, stationAnchor } from '@/lib/insights';
import { alertPhrase } from '@/lib/station-watch';

export type StationAlertCrossing = StationAlertCrossingResponseDto;

export type AlertPoint = StationAlertCrossing['series'][number];

type Measure = StationAlertCrossing['threshold']['measure'];

export const formatMeasureValue = (
  measure: Measure,
  value: number | null,
  currency: string | null,
): string => {
  if (value === null) {
    return '–';
  }

  return measure === 'cost_per_run'
    ? amountIn(value, currency)
    : formatShare(value);
};

const lastRuns = (over: number): string =>
  over === 1 ? 'the last run' : `the last ${over} runs`;

const runsBefore = (over: number): string =>
  over === 1 ? 'the one before' : `the ${over} before`;

const DID: Record<Exclude<Measure, 'cost_per_run'>, [string, string]> = {
  sent_back_rate: ['were sent back', 'was sent back'],
  accepted_rate: ['were accepted', 'was accepted'],
  merged_rate: ['were merged', 'was merged'],
  failed_rate: ['failed', 'failed'],
  checks_failed_rate: ['failed their checks', 'failed its checks'],
};

const MOVED_FROM: Record<
  NonNullable<StationAlertCrossing['change']>['direction'],
  string
> = {
  up: 'up from',
  down: 'down from',
  same: 'the same as',
};

export const formatThreshold = (alert: StationAlertCrossing): string =>
  alertPhrase(alert.threshold, alert.currency);

export const formatCrossing = (alert: StationAlertCrossing): string => {
  const { measure, over } = alert.threshold;
  const shown = (value: number | null) =>
    formatMeasureValue(measure, value, alert.currency);
  const before =
    alert.baseline === null
      ? ''
      : `, ${MOVED_FROM[alert.change?.direction ?? 'same']} ${shown(alert.baseline)} in ${runsBefore(over)}`;

  if (measure === 'cost_per_run') {
    const each = over === 1 ? '' : ' each on average';
    const runs = lastRuns(over);

    return `${runs.charAt(0).toUpperCase()}${runs.slice(1)} cost ${shown(alert.value)}${each}${before}.`;
  }

  return `${shown(alert.value)} of ${lastRuns(over)} ${DID[measure][over === 1 ? 1 : 0]}${before}.`;
};

const formatChange = (
  measure: Measure,
  change: number,
  currency: string | null,
  direction: 'rise' | 'fall',
): string => {
  if (measure === 'cost_per_run') {
    return `a ${direction} of ${formatMeasureValue(measure, change, currency)}`;
  }

  return `a ${Math.round(change * 1000) / 10}-point ${direction}`;
};

export const formatLimit = (alert: StationAlertCrossing): string => {
  const { measure, risesBy, fallsBy, above, below } = alert.threshold;
  const shown = (value: number) =>
    formatMeasureValue(measure, value, alert.currency);

  if (risesBy !== null) {
    return `The alert is set at ${formatChange(measure, risesBy, alert.currency, 'rise')}.`;
  }
  if (fallsBy !== null) {
    return `The alert is set at ${formatChange(measure, fallsBy, alert.currency, 'fall')}.`;
  }
  if (below !== null) {
    return `The alert is set at below ${shown(below)}.`;
  }

  return `The alert is set at above ${shown(above ?? 0)}.`;
};

export const ALERT_LEVEL = 'Alert level';

export const BEFORE_LEVEL = 'Before';

export const CROSSING_RUN = 'The run it went off at';

export const formatRecovered = (
  alert: StationAlertCrossing,
  day: string,
): string => {
  const { fallsBy, below } = alert.threshold;
  const side = fallsBy !== null || below !== null ? 'over' : 'under';

  return `The station has been back ${side} the threshold since ${day}.`;
};

export const thresholdLine = (alert: StationAlertCrossing): number | null =>
  alert.threshold.above ?? alert.threshold.below ?? null;

export const alertOnInsightsPath = (
  slug: string,
  teamId: string,
  alert: StationAlertCrossing,
): string =>
  `${insightsPath(slug, teamId, {
    tab: 'stations',
    period: alert.insightsPeriod,
    filter: {},
    page: 1,
  })}#${stationAnchor(alert.stationId)}`;
