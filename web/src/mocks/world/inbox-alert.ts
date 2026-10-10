import { DELIVERY_ID, PLATFORM_ID } from '@/mocks/world';
import { type HistoryRun, history } from '@/mocks/world/insights-history';
import { FINGERPRINTS } from '@/mocks/world/station-history';

export const ALERT_STATION = 'station_implementation';
export const ALERT_OVER = 20;
export const ALERT_RISES_BY = 0.2;
export const COST_ALERT_OVER = 10;
export const COST_ALERT_ABOVE = 2;
const SERIES_POINTS = 18;

type AlertPoint = {
  readonly run: HistoryRun;
  readonly value: number | null;
};

export type AlertCrossing = {
  readonly run: HistoryRun;
  readonly value: number;
  readonly baseline: number | null;
  readonly recovered: HistoryRun | null;
  readonly series: readonly AlertPoint[];
};

type Watch = {
  readonly over: number;
  readonly measure: (run: HistoryRun) => number;
  readonly fromBaseline: boolean;
  readonly crosses: (value: number, baseline: number | null) => boolean;
};

const SENT_BACK: Watch = {
  over: ALERT_OVER,
  measure: (run) => (run.next?.act === 'sent-back' ? 1 : 0),
  fromBaseline: true,
  crosses: (value, baseline) =>
    baseline !== null && value - baseline >= ALERT_RISES_BY - 1e-9,
};

const COST: Watch = {
  over: COST_ALERT_OVER,
  measure: (run) => run.cost?.amount ?? 0,
  fromBaseline: false,
  crosses: (value) => value > COST_ALERT_ABOVE,
};

const trailing = (
  runs: readonly HistoryRun[],
  end: number,
  { over, measure }: Watch,
) =>
  end + 1 < over
    ? null
    : runs
        .slice(end + 1 - over, end + 1)
        .reduce((sum, run) => sum + measure(run), 0) / over;

const stationRuns = () =>
  history()
    .runs.filter(
      (run) =>
        run.teamId === PLATFORM_ID &&
        run.lineId === DELIVERY_ID &&
        run.stationId === ALERT_STATION,
    )
    .sort((one, other) => one.at - other.at);

const crossingOf = (watch: Watch): AlertCrossing | null => {
  const runs = stationRuns();
  const values = runs.map((_, end) => trailing(runs, end, watch));
  const changedAt = runs.findIndex(
    (run) => run.fingerprint === FINGERPRINTS.effort,
  );
  const baseline = watch.fromBaseline ? (values[changedAt - 1] ?? null) : null;

  if (changedAt < 1 || (watch.fromBaseline && baseline === null)) {
    return null;
  }

  const crosses = (at: number) => {
    const value = values[at];
    return (
      value !== null && value !== undefined && watch.crosses(value, baseline)
    );
  };
  const found = watch.fromBaseline
    ? values.findIndex((_, at) => at >= changedAt && crosses(at))
    : values.findLastIndex(
        (_, at) => at >= changedAt && crosses(at) && !crosses(at - 1),
      );
  const crossed =
    found >= 0 || !watch.fromBaseline
      ? found
      : values.reduce<number>(
          (best, value, at) =>
            at >= changedAt && (value ?? 0) > (values[best] ?? 0) ? at : best,
          changedAt,
        );
  const recoveredAt = values.findIndex((_, at) => at > crossed && !crosses(at));
  const run = runs[crossed];

  if (!run) {
    return null;
  }

  return {
    run,
    value: values[crossed] ?? 0,
    baseline,
    recovered: recoveredAt >= 0 ? (runs[recoveredAt] ?? null) : null,
    series: runs
      .slice(Math.max(0, crossed + 1 - SERIES_POINTS), crossed + 1)
      .map((each) => ({
        run: each,
        value: values[runs.indexOf(each)] ?? null,
      })),
  };
};

const once = (watch: Watch) => {
  let made: { readonly crossing: AlertCrossing | null } | null = null;

  return (): AlertCrossing | null => {
    made ??= { crossing: crossingOf(watch) };
    return made.crossing;
  };
};

export const alertCrossing = once(SENT_BACK);

export const costAlertCrossing = once(COST);
