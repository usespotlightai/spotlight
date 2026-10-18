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

export type AlertFiring = {
  readonly run: HistoryRun;
  readonly value: number;
  readonly baseline: number | null;
  readonly resolved: HistoryRun | null;
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
  measure: (run) => (run.firstHumanAction?.kind === 'sent-back' ? 1 : 0),
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

const firingOf = (watch: Watch): AlertFiring | null => {
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
  const fired =
    found >= 0 || !watch.fromBaseline
      ? found
      : values.reduce<number>(
          (best, value, at) =>
            at >= changedAt && (value ?? 0) > (values[best] ?? 0) ? at : best,
          changedAt,
        );
  const resolvedAt = values.findIndex((_, at) => at > fired && !crosses(at));
  const run = runs[fired];

  if (!run) {
    return null;
  }

  return {
    run,
    value: values[fired] ?? 0,
    baseline,
    resolved: resolvedAt >= 0 ? (runs[resolvedAt] ?? null) : null,
    series: runs
      .slice(Math.max(0, fired + 1 - SERIES_POINTS), fired + 1)
      .map((each) => ({
        run: each,
        value: values[runs.indexOf(each)] ?? null,
      })),
  };
};

const once = (watch: Watch) => {
  let made: { readonly firing: AlertFiring | null } | null = null;

  return (): AlertFiring | null => {
    made ??= { firing: firingOf(watch) };
    return made.firing;
  };
};

export const alertFiring = once(SENT_BACK);

export const costAlertFiring = once(COST);
