import {
  type RuleReading,
  StationAlertState,
} from '@insights/domain/aggregates/station-alert-state.aggregate';
import { StationAlertFired } from '@insights/domain/events/station-alert-fired.event';
import { StationAlertReopened } from '@insights/domain/events/station-alert-reopened.event';
import { StationAlertResolved } from '@insights/domain/events/station-alert-resolved.event';
import { TEAM, WORKSPACE } from '@insights/domain/runs.fake-spec';
import { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import { AlertRule } from '@insights/domain/value-objects/alert-rule.vo';
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
  StationAlertState.start({
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

const kinds = (alertState: StationAlertState) =>
  alertState.pullEvents().map((each) => each.kind);

const checkedAlong = (
  alertState: StationAlertState,
  next: () => AlertId,
  readings: readonly RuleReading[],
): StationAlertState =>
  readings.reduce(
    (checked, each) =>
      checked.check(
        [each],
        atRun(Number(each.reading?.runId.value.slice(4))),
        next,
      ),
    alertState,
  );

describe('StationAlertState', () => {
  it('fires an alert on the newest measured run whose reading meets a condition', () => {
    const alertState = begun().check([rising(1, 0.6, 0.3)], atRun(1), ids());

    const [fired] = alertState.pullEvents();
    expect(fired).toBeInstanceOf(StationAlertFired);
    expect(alertState.open).toHaveLength(1);
    expect(alertState.open[0]?.taskId.value).toBe('task_1');
    expect(alertState.open[0]?.runId.value).toBe('run_1');
    expect(alertState.open[0]?.reading).toEqual({ value: 0.6, baseline: 0.3 });
  });

  it('fires once while the station stays past the threshold', () => {
    const next = ids();
    const fired = begun().check([rising(1, 0.6, 0.3)], atRun(1), next);
    fired.pullEvents();

    const again = fired.check([rising(2, 0.7, 0.3)], atRun(2), next);

    expect(again).toBe(fired);
    expect(again.open).toHaveLength(1);
  });

  it('resolves only once the reading has stayed clear for as many further measured runs as it compares', () => {
    const next = ids();
    const fired = begun().check([rising(1, 0.6, 0.3)], atRun(1), next);
    fired.pullEvents();

    const once = fired.check([rising(2, 0.3, 0.3)], atRun(2), next);

    expect(kinds(once)).toEqual([]);
    expect(once.open).toHaveLength(1);
    expect(once.open[0]?.clearRuns).toBe(1);

    const twice = once.check([rising(3, 0.3, 0.3)], atRun(3), next);

    expect(kinds(twice)).toEqual(['station-alert.resolved']);
    expect(twice.open).toEqual([]);
    expect(twice.firings[0]?.resolvedAt).toEqual(atRun(3));
  });

  it('counts a measured run once however often it is read', () => {
    const next = ids();
    const fired = begun().check([rising(1, 0.6, 0.3)], atRun(1), next);
    const once = fired.check([rising(2, 0.3, 0.3)], atRun(2), next);

    const again = once.check([rising(2, 0.3, 0.3)], atRun(3), next);

    expect(again).toBe(once);
    expect(again.open[0]?.clearRuns).toBe(1);
  });

  it('starts counting again when the reading crosses while it is resolving', () => {
    const next = ids();
    const alertState = checkedAlong(begun(), next, [
      rising(1, 0.6, 0.3),
      rising(2, 0.3, 0.3),
      rising(3, 0.6, 0.3),
      rising(4, 0.3, 0.3),
    ]);

    expect(alertState.open).toHaveLength(1);
    expect(alertState.open[0]?.clearRuns).toBe(1);
    expect(kinds(alertState)).toEqual(['station-alert.fired']);
  });

  it('reopens the alert it last resolved when the station crosses again soon after, rather than firing another', () => {
    const next = ids();
    const alertState = checkedAlong(begun(), next, [
      rising(1, 0.6, 0.3),
      rising(2, 0.3, 0.3),
      rising(3, 0.3, 0.3),
      rising(4, 0.6, 0.3),
    ]);

    const events = alertState.pullEvents();
    expect(events.map((each) => each.kind)).toEqual([
      'station-alert.fired',
      'station-alert.resolved',
      'station-alert.reopened',
    ]);
    expect(events[2]).toBeInstanceOf(StationAlertReopened);
    expect((events[2] as StationAlertReopened).taskId.value).toBe('task_1');
    expect(alertState.firings.map((each) => each.id.value)).toEqual([
      'alert_1',
    ]);
    expect(alertState.open[0]?.firedAt).toEqual(atRun(1));
  });

  it('fires a new alert once the station has stayed clear past its cooldown runs', () => {
    const next = ids();
    const alertState = checkedAlong(begun(), next, [
      rising(1, 0.6, 0.3),
      rising(2, 0.3, 0.3),
      rising(3, 0.3, 0.3),
      rising(4, 0.3, 0.3),
      rising(5, 0.3, 0.3),
      rising(6, 0.6, 0.3),
    ]);

    expect(kinds(alertState)).toEqual([
      'station-alert.fired',
      'station-alert.resolved',
      'station-alert.fired',
    ]);
    expect(alertState.open.map((each) => each.id.value)).toEqual(['alert_2']);
    expect(alertState.open[0]?.taskId.value).toBe('task_6');
  });

  it('resolves with the task the alert fired on', () => {
    const next = ids();
    const resolved = checkedAlong(begun(), next, [
      rising(1, 0.6, 0.3),
      rising(2, 0.3, 0.3),
      rising(3, 0.3, 0.3),
    ]);

    const events = resolved.pullEvents();
    const event = events[1] as StationAlertResolved;
    expect(event).toBeInstanceOf(StationAlertResolved);
    expect(event.taskId.value).toBe('task_1');
  });

  it('leaves an alert as it is while there are too few runs to read', () => {
    const next = ids();
    const fired = begun().check([rising(1, 0.6, 0.3)], atRun(1), next);

    expect(fired.check([{ rule: RISING, reading: null }], atRun(2), next)).toBe(
      fired,
    );
  });

  it('resolves at once an alert whose rule the station no longer sets, and fires anew if it comes back', () => {
    const next = ids();
    const fired = begun().check([rising(1, 0.6, 0.3)], atRun(1), next);
    fired.pullEvents();

    const resolved = fired.check([], atRun(2), next);

    expect(resolved.open).toEqual([]);
    expect(kinds(resolved)).toEqual(['station-alert.resolved']);

    const back = resolved.check([rising(3, 0.6, 0.3)], atRun(3), next);

    expect(back.open.map((each) => each.id.value)).toEqual(['alert_2']);
  });

  it('watches each condition apart', () => {
    const alertState = begun().check(
      [rising(1, 0.6, 0.3), read(PRICEY, 1, 1.5)],
      atRun(1),
      ids(),
    );

    expect(alertState.open.map((each) => each.rule.measure)).toEqual([
      'sent_back_rate',
    ]);
  });

  it('fires once for two identical rules', () => {
    const alertState = begun().check(
      [rising(1, 0.6, 0.3), rising(1, 0.6, 0.3)],
      atRun(1),
      ids(),
    );

    expect(kinds(alertState)).toEqual(['station-alert.fired']);
    expect(alertState.open).toHaveLength(1);
  });

  it('keeps an alert open, judged by the new threshold, when its threshold changes and the station still crosses it', () => {
    const next = ids();
    const fired = begun().check([rising(1, 0.6, 0.3)], atRun(1), next);
    fired.pullEvents();
    const edited = AlertRule.of({
      measure: 'sent_back_rate',
      risesBy: 0.25,
      over: 2,
    });

    const rejudged = fired.check([read(edited, 2, 0.65, 0.3)], atRun(2), next);

    expect(kinds(rejudged)).toEqual([]);
    expect(rejudged.open.map((each) => each.id.value)).toEqual(['alert_1']);
    expect(rejudged.open[0]?.rule.threshold).toBe(0.25);
    expect(rejudged.open[0]?.reading).toEqual({ value: 0.65, baseline: 0.3 });
    expect(rejudged.open[0]?.firedAt).toEqual(atRun(1));
    expect(rejudged.changed.map((each) => each.id.value)).toEqual(['alert_1']);
  });

  it('resolves an alert once its edited threshold has stayed uncrossed long enough', () => {
    const next = ids();
    const fired = begun().check([rising(1, 0.6, 0.3)], atRun(1), next);
    fired.pullEvents();
    const edited = AlertRule.of({
      measure: 'sent_back_rate',
      risesBy: 0.5,
      over: 2,
    });

    const resolved = checkedAlong(fired, next, [
      read(edited, 2, 0.6, 0.3),
      read(edited, 3, 0.6, 0.3),
    ]);

    expect(kinds(resolved)).toEqual(['station-alert.resolved']);
    expect(resolved.open).toEqual([]);
  });

  it('changes only the alerts it fired, resolved or re-judged', () => {
    const next = ids();
    const original = StationAlertState.rehydrate({
      station: begun().station,
      firings: begun().check([rising(1, 0.6, 0.3)], atRun(1), next).firings,
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

  it('lets go of every alert fired on a deleted task, naming them to drop', () => {
    const next = ids();
    const alertState = begun()
      .check([rising(1, 0.6, 0.3)], atRun(1), next)
      .check([rising(2, 0.6, 0.3), read(PRICEY, 2, 3)], atRun(2), next);
    alertState.pullEvents();

    const withoutTask = alertState.withoutTask(TaskId.of('task_1'));

    expect(withoutTask.firings.map((each) => each.id.value)).toEqual([
      'alert_2',
    ]);
    expect(withoutTask.dropped.map((each) => each.value)).toEqual(['alert_1']);
    expect(withoutTask.changed.map((each) => each.id.value)).toEqual([
      'alert_2',
    ]);
    expect(kinds(withoutTask)).toEqual([]);
    expect(withoutTask.withoutTask(TaskId.of('task_9'))).toBe(withoutTask);
  });

  it('rejects two open firings for one rule', () => {
    const next = ids();
    const fired = begun().check([rising(1, 0.6, 0.3)], atRun(1), next);
    const open = fired.open[0];

    expect(() =>
      StationAlertState.rehydrate({
        station: fired.station,
        firings: open ? [open, open] : [],
        version: 0,
      }),
    ).toThrow(/once per rule/);
  });
});
