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

const pointsSaid = (share: number): string => {
  const points = Math.round(share * 1000) / 10;

  return `${points} ${points === 1 ? 'point' : 'points'}`;
};

const overRuns = (over: number): string =>
  over === 1 ? 'in a single run' : `over ${over} runs`;

const changeOverRuns = (over: number): string =>
  over === 1 ? 'from one run to the next' : `over ${over} runs`;

export type AlertTrigger = 'rises' | 'falls' | 'above' | 'below';

export type AlertFace = {
  readonly measure: string;
  readonly trigger: AlertTrigger;
  readonly threshold: string;
  readonly window: string;
};

type AlertReading = {
  readonly trigger: AlertTrigger;
  readonly amount: number;
};

const readingOf = (alert: AlertThreshold): AlertReading => {
  if (alert.risesBy !== null) {
    return { trigger: 'rises', amount: alert.risesBy };
  }
  if (alert.fallsBy !== null) {
    return { trigger: 'falls', amount: alert.fallsBy };
  }
  if (alert.below !== null) {
    return { trigger: 'below', amount: alert.below };
  }

  return { trigger: 'above', amount: alert.above ?? 0 };
};

const isChange = (trigger: AlertTrigger): boolean =>
  trigger === 'rises' || trigger === 'falls';

const thresholdShown = (
  alert: AlertThreshold,
  { trigger, amount }: AlertReading,
  currency: string | null,
  points: (share: number) => string,
): string => {
  if (!isChange(trigger)) {
    return amountOf(alert, amount, currency);
  }

  return alert.measure === 'cost_per_run'
    ? amountIn(amount, currency)
    : points(amount);
};

const BOUNDS: Record<AlertTrigger, string> = {
  rises: '+',
  falls: '−',
  below: '< ',
  above: '> ',
};

const SAID: Record<AlertTrigger, (threshold: string) => string> = {
  rises: (threshold) => `rises ${threshold} or more`,
  falls: (threshold) => `falls ${threshold} or more`,
  below: (threshold) => `drops below ${threshold}`,
  above: (threshold) => `goes above ${threshold}`,
};

export const alertFace = (
  alert: AlertThreshold,
  currency: string | null = null,
): AlertFace => {
  const reading = readingOf(alert);

  return {
    measure: MEASURES[alert.measure],
    trigger: reading.trigger,
    threshold: `${BOUNDS[reading.trigger]}${thresholdShown(alert, reading, currency, pointsShown)}`,
    window: isChange(reading.trigger)
      ? changeOverRuns(alert.over)
      : overRuns(alert.over),
  };
};

export const alertPhrase = (
  alert: AlertThreshold,
  currency: string | null = null,
): string => {
  const { measure, trigger, window } = alertFace(alert, currency);
  const threshold = thresholdShown(
    alert,
    readingOf(alert),
    currency,
    pointsSaid,
  );

  return `Alerts when the ${measure.toLowerCase()} ${SAID[trigger](threshold)} ${window}`;
};
