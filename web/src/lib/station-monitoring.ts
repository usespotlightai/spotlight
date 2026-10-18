import type {
  StationAlertResponseDto,
  StationJudgeResponseDto,
} from '@/lib/api';
import { amountIn } from '@/lib/inbox';
import { formatPoints } from '@/lib/replay-words';

export type JudgeSettings = StationJudgeResponseDto;

export type AlertRule = StationAlertResponseDto;

export type AlertMeasure = AlertRule['measure'];

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
  alert: AlertRule,
  amount: number,
  currency: string | null,
): string =>
  alert.measure === 'cost_per_run'
    ? amountIn(amount, currency)
    : sharePercent(amount);

const pointsText = (share: number): string => {
  const points = Math.round(share * 1000) / 10;

  return `${points} ${points === 1 ? 'point' : 'points'}`;
};

const overRuns = (over: number): string =>
  over === 1 ? 'in a single run' : `over ${over} runs`;

const changeOverRuns = (over: number): string =>
  over === 1 ? 'from one run to the next' : `over ${over} runs`;

export type AlertCondition = 'rises' | 'falls' | 'above' | 'below';

export type AlertFace = {
  readonly measure: string;
  readonly condition: AlertCondition;
  readonly threshold: string;
  readonly window: string;
};

type AlertReading = {
  readonly condition: AlertCondition;
  readonly threshold: number;
};

const readingOf = (alert: AlertRule): AlertReading => {
  if (alert.risesBy !== null) {
    return { condition: 'rises', threshold: alert.risesBy };
  }
  if (alert.fallsBy !== null) {
    return { condition: 'falls', threshold: alert.fallsBy };
  }
  if (alert.below !== null) {
    return { condition: 'below', threshold: alert.below };
  }

  return { condition: 'above', threshold: alert.above ?? 0 };
};

const isChange = (condition: AlertCondition): boolean =>
  condition === 'rises' || condition === 'falls';

const formatThreshold = (
  alert: AlertRule,
  { condition, threshold }: AlertReading,
  currency: string | null,
  points: (share: number) => string,
): string => {
  if (!isChange(condition)) {
    return amountOf(alert, threshold, currency);
  }

  return alert.measure === 'cost_per_run'
    ? amountIn(threshold, currency)
    : points(threshold);
};

const BOUNDS: Record<AlertCondition, string> = {
  rises: '+',
  falls: '−',
  below: '< ',
  above: '> ',
};

const CONDITION_TEXT: Record<AlertCondition, (threshold: string) => string> = {
  rises: (threshold) => `rises ${threshold} or more`,
  falls: (threshold) => `falls ${threshold} or more`,
  below: (threshold) => `drops below ${threshold}`,
  above: (threshold) => `goes above ${threshold}`,
};

export const alertFace = (
  alert: AlertRule,
  currency: string | null = null,
): AlertFace => {
  const reading = readingOf(alert);

  return {
    measure: MEASURES[alert.measure],
    condition: reading.condition,
    threshold: `${BOUNDS[reading.condition]}${formatThreshold(alert, reading, currency, formatPoints)}`,
    window: isChange(reading.condition)
      ? changeOverRuns(alert.over)
      : overRuns(alert.over),
  };
};

export const alertPhrase = (
  alert: AlertRule,
  currency: string | null = null,
): string => {
  const { measure, condition, window } = alertFace(alert, currency);
  const threshold = formatThreshold(
    alert,
    readingOf(alert),
    currency,
    pointsText,
  );

  return `Alerts when the ${measure.toLowerCase()} ${CONDITION_TEXT[condition](threshold)} ${window}`;
};
