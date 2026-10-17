import type {
  ChangeResponseDto,
  InsightsPeriodResponseDto,
  MeasureVerdictResponseDto,
  RunTallyResponseDto,
  SpreadResponseDto,
} from '@/lib/api';

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const CURRENCY = 'USD';

export type PeriodName = InsightsPeriodResponseDto['name'];

const LENGTHS: Record<PeriodName, number> = { '7d': 7, '30d': 30, '90d': 90 };

export const periodNameOf = (raw: string | null): PeriodName =>
  raw === '7d' || raw === '90d' ? raw : '30d';

export const midnight = (at: number): number =>
  Math.floor(at / DAY_MS) * DAY_MS;

export const dayOf = (at: number): string =>
  new Date(at).toISOString().slice(0, 10);

export const isoOf = (at: number): string => new Date(at).toISOString();

export type Window = { readonly from: number; readonly to: number };

export type Span = {
  readonly period: InsightsPeriodResponseDto;
  readonly now: Window;
  readonly before: Window;
  readonly length: number;
};

export const spanOf = (name: PeriodName): Span => {
  const length = LENGTHS[name];
  const to = midnight(Date.now()) + DAY_MS;
  const from = to - length * DAY_MS;
  const previousFrom = from - length * DAY_MS;

  return {
    length,
    now: { from, to },
    before: { from: previousFrom, to: from },
    period: {
      name,
      from: isoOf(from),
      to: isoOf(to),
      previousFrom: isoOf(previousFrom),
      previousTo: isoOf(from),
      days: Array.from({ length }, (_, at) => dayOf(from + at * DAY_MS)),
    },
  };
};

export const within = (at: number, window: Window): boolean =>
  at >= window.from && at < window.to;

export const mondaysOf = (span: Span): string[] => {
  const first = new Date(span.now.from);
  const back = (first.getUTCDay() + 6) % 7;
  const start = span.now.from - back * DAY_MS;

  return Array.from(
    { length: Math.ceil((span.now.to - start) / (7 * DAY_MS)) },
    (_, at) => dayOf(start + at * 7 * DAY_MS),
  );
};

export const weekOf = (at: number): string => {
  const back = (new Date(at).getUTCDay() + 6) % 7;
  return dayOf(midnight(at) - back * DAY_MS);
};

export const quantile = (
  values: readonly number[],
  share: number,
): number | null => {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((one, other) => one - other);

  return (
    sorted[Math.min(sorted.length - 1, Math.ceil(share * sorted.length) - 1)] ??
    null
  );
};

export const spreadOf = (values: readonly number[]): SpreadResponseDto => ({
  p50Ms: quantile(values, 0.5),
  p90Ms: quantile(values, 0.9),
  count: values.length,
});

export const shareOf = (part: number, whole: number): number | null =>
  whole > 0 ? part / whole : null;

export const cents = (amount: number): number => Math.round(amount * 100) / 100;

export const sumOf = (values: readonly number[]): number =>
  values.reduce((sum, each) => sum + each, 0);

export const distinct = <T>(values: readonly T[]): T[] => [...new Set(values)];

export type Better = 'up' | 'down' | 'neither';

const toneOf = (
  by: number | null,
  better: Better,
): ChangeResponseDto['tone'] => {
  if (by === 0 || better === 'neither') {
    return 'flat';
  }
  const rose = by === null || by > 0;

  return rose === (better === 'up') ? 'good' : 'bad';
};

const rounded = (value: number): number => Math.round(value * 1000) / 1000;

export const changeOf = (
  now: number | null,
  before: number | null,
  better: Better,
  unit: ChangeResponseDto['unit'] = 'percent',
): ChangeResponseDto | null => {
  if (now === null || before === null) {
    return null;
  }
  const by =
    unit === 'points'
      ? rounded(now - before)
      : before === 0
        ? now === 0
          ? 0
          : null
        : rounded(now / before - 1);

  return {
    unit,
    by,
    fromZero: by === null,
    direction: by === null || by > 0 ? 'up' : by < 0 ? 'down' : 'same',
    tone: toneOf(by, better),
  };
};

export const NO_CHANGE: ChangeResponseDto = {
  unit: 'percent',
  by: 0,
  fromZero: false,
  direction: 'same',
  tone: 'flat',
};

export const emptyTally = (): RunTallyResponseDto => ({
  runs: 0,
  cancelled: 0,
  failed: 0,
  failedShare: null,
  stopped: 0,
  checksPassed: 0,
  checksFailed: 0,
  accepted: 0,
  sentBack: 0,
  passed: 0,
  merged: 0,
  cost: null,
  unpriced: 0,
  mixedCurrencies: false,
  medianMs: null,
  p90Ms: null,
});

type Measure = MeasureVerdictResponseDto['measure'];

export const MEASURES: readonly Measure[] = [
  'sent_back_rate',
  'accepted_rate',
  'checks_failed_rate',
  'failed_rate',
  'merged_rate',
  'cost_per_run',
];

const MIN_MEASURED = 10;

const LOWER_IS_BETTER: ReadonlySet<Measure> = new Set([
  'sent_back_rate',
  'checks_failed_rate',
  'failed_rate',
  'cost_per_run',
]);

export type Reading = {
  readonly value: number | null;
  readonly measured: number;
};

const verdictOf = (
  measure: Measure,
  before: Reading,
  after: Reading,
): MeasureVerdictResponseDto['verdict'] => {
  if (
    before.value === null ||
    after.value === null ||
    before.measured < MIN_MEASURED ||
    after.measured < MIN_MEASURED
  ) {
    return 'insufficient';
  }
  const moved =
    measure === 'cost_per_run'
      ? before.value === 0
        ? 0
        : after.value / before.value - 1
      : after.value - before.value;
  const threshold = measure === 'cost_per_run' ? 0.1 : 0.05;

  if (Math.abs(moved) < threshold) {
    return 'unchanged';
  }

  return moved < 0 === LOWER_IS_BETTER.has(measure) ? 'better' : 'worse';
};

export const verdictFor = (
  measure: Measure,
  before: Reading,
  after: Reading,
): MeasureVerdictResponseDto => {
  const verdict = verdictOf(measure, before, after);
  const better: Better = LOWER_IS_BETTER.has(measure) ? 'down' : 'up';

  return {
    measure,
    before: before.value === null ? null : rounded(before.value),
    after: after.value === null ? null : rounded(after.value),
    measuredBefore: before.measured,
    measuredAfter: after.measured,
    currency: measure === 'cost_per_run' ? CURRENCY : null,
    verdict,
    change: changeOf(
      after.value,
      before.value,
      verdict === 'insufficient' ? 'neither' : better,
      measure === 'cost_per_run' ? 'percent' : 'points',
    ),
  };
};
