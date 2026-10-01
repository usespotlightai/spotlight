import type {
  StationAlertResponseDto,
  StationJudgeResponseDto,
} from '@/lib/api';
import { amountIn } from '@/lib/inbox';

export type JudgeSettings = StationJudgeResponseDto;

export type AlertThreshold = StationAlertResponseDto;

export type AlertMeasure = AlertThreshold['measure'];

const MEASURES: Record<AlertMeasure, string> = {
  sent_back_rate: 'Sent-back rate',
  accepted_rate: 'Accepted rate',
  checks_failed_rate: 'Checks-failed rate',
  failed_rate: 'Failed rate',
  merged_rate: 'Merged rate',
  cost_per_run: 'Cost per run',
};

export const alertMeasureLabel = (measure: AlertMeasure): string =>
  MEASURES[measure];

const PERCENT = new Intl.NumberFormat('en', {
  style: 'percent',
  maximumFractionDigits: 1,
});

export const sharePercent = (share: number): string => PERCENT.format(share);

const amountOf = (
  alert: AlertThreshold,
  amount: number,
  currency: string | null,
): string =>
  alert.measure === 'cost_per_run'
    ? amountIn(amount, currency)
    : sharePercent(amount);

const changeOf = (
  alert: AlertThreshold,
  change: number,
  currency: string | null,
): string => {
  if (alert.measure === 'cost_per_run') {
    return amountIn(change, currency);
  }

  const points = Math.round(change * 1000) / 10;

  return `${points} ${points === 1 ? 'point' : 'points'}`;
};

const lastRuns = (over: number): string =>
  over === 1 ? 'the last run' : `the last ${over} runs`;

const runsBefore = (over: number): string =>
  over === 1 ? 'the one before' : `the ${over} before`;

const thresholdOf = (
  alert: AlertThreshold,
  currency: string | null,
): string => {
  const compared = `in ${lastRuns(alert.over)}, against ${runsBefore(alert.over)}`;
  const across = `across ${lastRuns(alert.over)}`;

  if (alert.risesBy !== null) {
    return `up ${changeOf(alert, alert.risesBy, currency)} ${compared}`;
  }
  if (alert.fallsBy !== null) {
    return `down ${changeOf(alert, alert.fallsBy, currency)} ${compared}`;
  }
  if (alert.below !== null) {
    return `below ${amountOf(alert, alert.below, currency)} ${across}`;
  }

  return `above ${amountOf(alert, alert.above ?? 0, currency)} ${across}`;
};

export const alertPhrase = (
  alert: AlertThreshold,
  currency: string | null = null,
): string => `${MEASURES[alert.measure]} ${thresholdOf(alert, currency)}`;
