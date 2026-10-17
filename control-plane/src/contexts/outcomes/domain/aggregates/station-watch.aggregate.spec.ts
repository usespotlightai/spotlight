import {
  type RuleReading,
  StationWatch,
} from '@outcomes/domain/aggregates/station-watch.aggregate';
import { StationAlertRaised } from '@outcomes/domain/events/station-alert-raised.event';
import { StationAlertRecovered } from '@outcomes/domain/events/station-alert-recovered.event';
import { StationAlertReopened } from '@outcomes/domain/events/station-alert-reopened.event';
import { TEAM, WORKSPACE } from '@outcomes/domain/outcomes.fake-spec';
import { AlertId } from '@outcomes/domain/value-objects/alert-id.vo';
import { AlertRule } from '@outcomes/domain/value-objects/alert-rule.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const RISING = AlertRule.of({
  measure: 'sent_back_rate',
  risesBy: 0.2,
  over: 2,
});

const PRICEY = AlertRule.of({ measure: 'cost_per_run', above: 2, over: 3 });

const begun = () =>
  StationWatch.start({
    workspaceId: WORKSPACE,
    teamId: TEAM,
    lineId: 'line_1',
    stationId: 'station_1',
  });

const ids = () => {
  let next = 0;
  return () => {
    next += 1;
    return AlertId.of(`alert_${next}`);
  };
};

const atRun = (run: number) =>
  new Date(`2026-09-30T${String(run).padStart(2, '0')}:00:00.000Z`);

const read = (
  rule: AlertRule,
  run: number,
  value: number,
  baseline: number | null = null,
): RuleReading => ({
  rule,
  reading: {
    value,
    baseline,
    runId: RunId.of(`run_${run}`),
    taskId: TaskId.of(`task_${run}`),
  },
});

const rising = (run: number, value: number, baseline: number): RuleReading =>
  read(RISING, run, value, baseline);

const kinds = (watch: StationWatch) =>
  watch.pullEvents().map((each) => each.kind);

const checkedAlong = (
  watch: StationWatch,
  next: () => AlertId,
  readings: readonly RuleReading[],
): StationWatch =>
  readings.reduce(
    (checked, each) =>
      checked.check(
        [each],
        atRun(Number(each.reading?.runId.value.slice(4))),
        next,
      ),
    watch,
  );

describe('StationWatch', () => {
  it('raises an alert on the newest settled run whose reading crosses a threshold', () => {
    const watch = begun().check([rising(1, 0.6, 0.3)], atRun(1), ids());

    const [raised] = watch.pullEvents();
    expect(raised).toBeInstanceOf(StationAlertRaised);
    expect(watch.open).toHaveLength(1);
    expect(watch.open[0]?.taskId.value).toBe('task_1');
    expect(watch.open[0]?.runId.value).toBe('run_1');
    expect(watch.open[0]?.reading).toEqual({ value: 0.6, baseline: 0.3 });
  });

  it('raises once while the station stays past the threshold', () => {
    const next = ids();
    const raised = begun().check([rising(1, 0.6, 0.3)], atRun(1), next);
    raised.pullEvents();

    const again = raised.check([rising(2, 0.7, 0.3)], atRun(2), next);

    expect(again).toBe(raised);
    expect(again.open).toHaveLength(1);
  });

  it('recovers only once the reading has stayed clear for as many further settled runs as it compares', () => {
    const next = ids();
    const raised = begun().check([rising(1, 0.6, 0.3)], atRun(1), next);
    raised.pullEvents();

    const once = raised.check([rising(2, 0.3, 0.3)], atRun(2), next);

    expect(kinds(once)).toEqual([]);
    expect(once.open).toHaveLength(1);
    expect(once.open[0]?.clearRuns).toBe(1);

    const twice = once.check([rising(3, 0.3, 0.3)], atRun(3), next);

    expect(kinds(twice)).toEqual(['station-alert.recovered']);
    expect(twice.open).toEqual([]);
    expect(twice.crossings[0]?.recoveredAt).toEqual(atRun(3));
  });

  it('counts a settled run once however often it is read', () => {
    const next = ids();
    const raised = begun().check([rising(1, 0.6, 0.3)], atRun(1), next);
    const once = raised.check([rising(2, 0.3, 0.3)], atRun(2), next);

    const again = once.check([rising(2, 0.3, 0.3)], atRun(3), next);

    expect(again).toBe(once);
    expect(again.open[0]?.clearRuns).toBe(1);
  });

  it('starts counting again when the reading crosses while it is recovering', () => {
    const next = ids();
    const watch = checkedAlong(begun(), next, [
      rising(1, 0.6, 0.3),
      rising(2, 0.3, 0.3),
      rising(3, 0.6, 0.3),
      rising(4, 0.3, 0.3),
    ]);

    expect(watch.open).toHaveLength(1);
    expect(watch.open[0]?.clearRuns).toBe(1);
    expect(kinds(watch)).toEqual(['station-alert.raised']);
  });

  it('reopens the alert it last recovered when the station crosses again soon after, rather than raising another', () => {
    const next = ids();
    const watch = checkedAlong(begun(), next, [
      rising(1, 0.6, 0.3),
      rising(2, 0.3, 0.3),
      rising(3, 0.3, 0.3),
      rising(4, 0.6, 0.3),
    ]);

    const events = watch.pullEvents();
    expect(events.map((each) => each.kind)).toEqual([
      'station-alert.raised',
      'station-alert.recovered',
      'station-alert.reopened',
    ]);
    expect(events[2]).toBeInstanceOf(StationAlertReopened);
    expect((events[2] as StationAlertReopened).taskId.value).toBe('task_1');
    expect(watch.crossings.map((each) => each.id.value)).toEqual(['alert_1']);
    expect(watch.open[0]?.raisedAt).toEqual(atRun(1));
  });

  it('raises a new alert once the station has stayed clear past its settling runs', () => {
    const next = ids();
    const watch = checkedAlong(begun(), next, [
      rising(1, 0.6, 0.3),
      rising(2, 0.3, 0.3),
      rising(3, 0.3, 0.3),
      rising(4, 0.3, 0.3),
      rising(5, 0.3, 0.3),
      rising(6, 0.6, 0.3),
    ]);

    expect(kinds(watch)).toEqual([
      'station-alert.raised',
      'station-alert.recovered',
      'station-alert.raised',
    ]);
    expect(watch.open.map((each) => each.id.value)).toEqual(['alert_2']);
    expect(watch.open[0]?.taskId.value).toBe('task_6');
  });

  it('recovers with the task the alert was raised on', () => {
    const next = ids();
    const recovered = checkedAlong(begun(), next, [
      rising(1, 0.6, 0.3),
      rising(2, 0.3, 0.3),
      rising(3, 0.3, 0.3),
    ]);

    const events = recovered.pullEvents();
    const settled = events[1] as StationAlertRecovered;
    expect(settled).toBeInstanceOf(StationAlertRecovered);
    expect(settled.taskId.value).toBe('task_1');
  });

  it('leaves an alert as it stands while there are too few runs to read', () => {
    const next = ids();
    const raised = begun().check([rising(1, 0.6, 0.3)], atRun(1), next);

    expect(
      raised.check([{ rule: RISING, reading: null }], atRun(2), next),
    ).toBe(raised);
  });

  it('recovers at once an alert whose threshold the station no longer sets, and raises anew if it comes back', () => {
    const next = ids();
    const raised = begun().check([rising(1, 0.6, 0.3)], atRun(1), next);
    raised.pullEvents();

    const withdrawn = raised.check([], atRun(2), next);

    expect(withdrawn.open).toEqual([]);
    expect(kinds(withdrawn)).toEqual(['station-alert.recovered']);

    const back = withdrawn.check([rising(3, 0.6, 0.3)], atRun(3), next);

    expect(back.open.map((each) => each.id.value)).toEqual(['alert_2']);
  });

  it('watches each threshold apart', () => {
    const watch = begun().check(
      [rising(1, 0.6, 0.3), read(PRICEY, 1, 1.5)],
      atRun(1),
      ids(),
    );

    expect(watch.open.map((each) => each.rule.measure)).toEqual([
      'sent_back_rate',
    ]);
  });

  it('raises once for two identical thresholds', () => {
    const watch = begun().check(
      [rising(1, 0.6, 0.3), rising(1, 0.6, 0.3)],
      atRun(1),
      ids(),
    );

    expect(kinds(watch)).toEqual(['station-alert.raised']);
    expect(watch.open).toHaveLength(1);
  });

  it('keeps an alert open, judged by the new amount, when its threshold is edited and still crossed', () => {
    const next = ids();
    const raised = begun().check([rising(1, 0.6, 0.3)], atRun(1), next);
    raised.pullEvents();
    const edited = AlertRule.of({
      measure: 'sent_back_rate',
      risesBy: 0.25,
      over: 2,
    });

    const rejudged = raised.check([read(edited, 2, 0.65, 0.3)], atRun(2), next);

    expect(kinds(rejudged)).toEqual([]);
    expect(rejudged.open.map((each) => each.id.value)).toEqual(['alert_1']);
    expect(rejudged.open[0]?.rule.amount).toBe(0.25);
    expect(rejudged.open[0]?.reading).toEqual({ value: 0.65, baseline: 0.3 });
    expect(rejudged.open[0]?.raisedAt).toEqual(atRun(1));
    expect(rejudged.changed.map((each) => each.id.value)).toEqual(['alert_1']);
  });

  it('recovers an alert once its edited threshold has stayed uncrossed long enough', () => {
    const next = ids();
    const raised = begun().check([rising(1, 0.6, 0.3)], atRun(1), next);
    raised.pullEvents();
    const edited = AlertRule.of({
      measure: 'sent_back_rate',
      risesBy: 0.5,
      over: 2,
    });

    const recovered = checkedAlong(raised, next, [
      read(edited, 2, 0.6, 0.3),
      read(edited, 3, 0.6, 0.3),
    ]);

    expect(kinds(recovered)).toEqual(['station-alert.recovered']);
    expect(recovered.open).toEqual([]);
  });

  it('changes only the alerts it raised, recovered or re-judged', () => {
    const next = ids();
    const original = StationWatch.rehydrate({
      station: begun().station,
      crossings: begun().check([rising(1, 0.6, 0.3)], atRun(1), next).crossings,
      version: 1,
    });

    const priced = original.check(
      [rising(2, 0.7, 0.3), read(PRICEY, 2, 3)],
      atRun(2),
      next,
    );

    expect(original.changed).toEqual([]);
    expect(priced.changed.map((each) => each.id.value)).toEqual(['alert_2']);
  });

  it('lets go of every alert raised on a forgotten task, naming them to drop', () => {
    const next = ids();
    const watch = begun()
      .check([rising(1, 0.6, 0.3)], atRun(1), next)
      .check([rising(2, 0.6, 0.3), read(PRICEY, 2, 3)], atRun(2), next);
    watch.pullEvents();

    const forgotten = watch.withoutTask(TaskId.of('task_1'));

    expect(forgotten.crossings.map((each) => each.id.value)).toEqual([
      'alert_2',
    ]);
    expect(forgotten.dropped.map((each) => each.value)).toEqual(['alert_1']);
    expect(forgotten.changed.map((each) => each.id.value)).toEqual(['alert_2']);
    expect(kinds(forgotten)).toEqual([]);
    expect(forgotten.withoutTask(TaskId.of('task_9'))).toBe(forgotten);
  });

  it('refuses to stand crossed twice for one threshold', () => {
    const next = ids();
    const raised = begun().check([rising(1, 0.6, 0.3)], atRun(1), next);
    const open = raised.open[0];

    expect(() =>
      StationWatch.rehydrate({
        station: raised.station,
        crossings: open ? [open, open] : [],
        version: 0,
      }),
    ).toThrow(/once per rule/);
  });
});
