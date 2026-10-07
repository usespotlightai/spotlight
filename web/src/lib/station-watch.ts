import type {
  StationAlertResponseDto,
  StationJudgeResponseDto,
} from '@/lib/api';
import { amountIn } from '@/lib/inbox';
import { pointsShown } from '@/lib/replay-words';

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

const overRuns = (over: number): string =>
  over === 1 ? 'in a single run' : `over ${over} runs`;

const changeOverRuns = (over: number): string =>
  over === 1 ? 'from one run to the next' : `over ${over} runs`;

const thresholdOf = (
  alert: AlertThreshold,
  currency: string | null,
): string => {
  if (alert.risesBy !== null) {
    return `rises ${changeOf(alert, alert.risesBy, currency)} or more ${changeOverRuns(alert.over)}`;
  }
  if (alert.fallsBy !== null) {
    return `falls ${changeOf(alert, alert.fallsBy, currency)} or more ${changeOverRuns(alert.over)}`;
  }
  if (alert.below !== null) {
    return `drops below ${amountOf(alert, alert.below, currency)} ${overRuns(alert.over)}`;
  }

  return `goes above ${amountOf(alert, alert.above ?? 0, currency)} ${overRuns(alert.over)}`;
};

export const alertPhrase = (
  alert: AlertThreshold,
  currency: string | null = null,
): string =>
  `Alerts when the ${MEASURES[alert.measure].toLowerCase()} ${thresholdOf(alert, currency)}`;

export type AlertTrigger = 'rises' | 'falls' | 'above' | 'below';

export type AlertFace = {
  readonly measure: string;
  readonly trigger: AlertTrigger;
  readonly threshold: string;
  readonly window: string;
};

const changeShown = (
  alert: AlertThreshold,
  change: number,
  currency: string | null,
): string =>
  alert.measure === 'cost_per_run'
    ? amountIn(change, currency)
    : pointsShown(change);

export const alertFace = (
  alert: AlertThreshold,
  currency: string | null = null,
): AlertFace => {
  const measure = MEASURES[alert.measure];

  if (alert.risesBy !== null) {
    return {
      measure,
      trigger: 'rises',
      threshold: `+${changeShown(alert, alert.risesBy, currency)}`,
      window: changeOverRuns(alert.over),
    };
  }
  if (alert.fallsBy !== null) {
    return {
      measure,
      trigger: 'falls',
      threshold: `−${changeShown(alert, alert.fallsBy, currency)}`,
      window: changeOverRuns(alert.over),
    };
  }
  if (alert.below !== null) {
    return {
      measure,
      trigger: 'below',
      threshold: `< ${amountOf(alert, alert.below, currency)}`,
      window: overRuns(alert.over),
    };
  }

  return {
    measure,
    trigger: 'above',
    threshold: `> ${amountOf(alert, alert.above ?? 0, currency)}`,
    window: overRuns(alert.over),
  };
};
