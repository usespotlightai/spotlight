import { day, taskPullRequestOf } from '@insights/domain/insights.fake-spec';
import { costedRecord, endedRecord } from '@insights/domain/runs.fake-spec';
import {
  measureAround,
  measureOf,
  readingOf,
} from '@insights/domain/services/station-measures';
import { AlertRule } from '@insights/domain/value-objects/alert-rule.vo';
import { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const RECEIVED_AT = new Date('2026-09-30T12:00:00.000Z');

const at = (hour: number) => day('2026-09-30', hour);

const through = (
  runId: string,
  value: number,
  baseline: number | null = null,
) => ({ value, baseline, runId: RunId.of(runId), taskId: expect.anything() });

const sentBack = (runId: string, hour: number) =>
  endedRecord(runId, {
    taskId: `task_${runId}`,
    endedAt: at(hour),
  }).recordAction(HumanAction.of('sent-back', at(hour)));

const accepted = (runId: string, hour: number) =>
  endedRecord(runId, {
    taskId: `task_${runId}`,
    endedAt: at(hour),
  }).recordAction(HumanAction.of('accepted', at(hour)));

describe('measureOf', () => {
  it('measures the share of runs sent back, accepted and failed', () => {
    const records = [
      sentBack('run_1', 1),
      accepted('run_2', 2),
      endedRecord('run_3', { endedAt: at(3), ending: 'failed' }),
      endedRecord('run_4', { endedAt: at(4), ending: 'cancelled' }),
    ];

    expect(measureOf('sent_back_rate', records, [])).toBeCloseTo(1 / 3);
    expect(measureOf('accepted_rate', records, [])).toBeCloseTo(1 / 3);
    expect(measureOf('failed_rate', records, [])).toBeCloseTo(1 / 3);
  });

  it('measures failed checks among checked runs, and merges among tasks', () => {
    const records = [
      endedRecord('run_1', { taskId: 'task_1', endedAt: at(1) }).recordCheck(
        'failed',
        RECEIVED_AT,
      ),
      endedRecord('run_2', { taskId: 'task_1', endedAt: at(2) }).recordCheck(
        'passed',
        RECEIVED_AT,
      ),
      endedRecord('run_3', { taskId: 'task_2', endedAt: at(3) }),
    ];
    const taskPullRequests = [
      taskPullRequestOf('task_1', {
        openedAt: at(2),
        closedAt: at(5),
        merged: true,
      }),
    ];

    expect(measureOf('checks_failed_rate', records, taskPullRequests)).toBe(
      0.5,
    );
    expect(measureOf('merged_rate', records, taskPullRequests)).toBe(0.5);
  });

  it('measures the cost of a priced run, and nothing where none was priced', () => {
    expect(
      measureOf(
        'cost_per_run',
        [
          costedRecord('run_1', { amount: 1, endedAt: at(1) }),
          costedRecord('run_2', { amount: 3, endedAt: at(2) }),
          costedRecord('run_3', {
            amount: null,
            currency: null,
            endedAt: at(3),
          }),
        ],
        [],
      ),
    ).toBe(2);
    expect(
      measureOf(
        'cost_per_run',
        [costedRecord('run_1', { amount: null, currency: null })],
        [],
      ),
    ).toBeNull();
  });
});

describe('readingOf', () => {
  const RISING = AlertRule.of({
    measure: 'sent_back_rate',
    risesBy: 0.5,
    over: 2,
  });

  it('reads the last runs against as many runs before them, skipping cancelled runs', () => {
    const reading = readingOf(
      RISING,
      [
        sentBack('run_4', 4),
        endedRecord('run_x', { endedAt: at(5), ending: 'cancelled' }),
        sentBack('run_3', 3),
        accepted('run_2', 2),
        accepted('run_1', 1),
      ],
      [],
    );

    expect(reading).toEqual(through('run_4', 1, 0));
  });

  it('reads nothing until there are enough runs to compare', () => {
    expect(
      readingOf(RISING, [sentBack('run_2', 2), sentBack('run_1', 1)], []),
    ).toBeNull();
    expect(
      readingOf(
        AlertRule.of({ measure: 'sent_back_rate', above: 0.5, over: 2 }),
        [sentBack('run_2', 2), accepted('run_1', 1)],
        [],
      ),
    ).toEqual(through('run_2', 0.5));
  });
});

describe('readingOf, among measured runs', () => {
  const FALLING = AlertRule.of({
    measure: 'accepted_rate',
    fallsBy: 0.5,
    over: 2,
  });

  it('reads accepted and sent-back rates only from runs a person acted on', () => {
    const reading = readingOf(
      FALLING,
      [
        endedRecord('run_5', { taskId: 'task_5', endedAt: at(5) }),
        accepted('run_4', 4),
        accepted('run_3', 3),
        accepted('run_2', 2),
        accepted('run_1', 1),
      ],
      [],
    );

    expect(reading).toEqual(through('run_4', 1, 1));
  });

  it('reads the merged rate only from runs whose pull request merged or closed', () => {
    const rule = AlertRule.of({ measure: 'merged_rate', below: 0.5, over: 1 });
    const records = [
      endedRecord('run_2', { taskId: 'task_2', endedAt: at(2) }),
      endedRecord('run_1', { taskId: 'task_1', endedAt: at(1) }),
    ];

    expect(
      readingOf(rule, records, [
        taskPullRequestOf('task_2', { openedAt: at(2) }),
        taskPullRequestOf('task_1', {
          openedAt: at(1),
          closedAt: at(3),
          merged: false,
        }),
      ]),
    ).toEqual(through('run_1', 0));
    expect(
      readingOf(rule, records, [
        taskPullRequestOf('task_2', { openedAt: at(2) }),
      ]),
    ).toBeNull();
  });

  it('reads failed checks only from runs with a verdict, and cost only from runs with recorded usage', () => {
    const checks = AlertRule.of({
      measure: 'checks_failed_rate',
      above: 0.5,
      over: 1,
    });
    const cost = AlertRule.of({ measure: 'cost_per_run', above: 1, over: 1 });
    const records = [
      endedRecord('run_3', { taskId: 'task_3', endedAt: at(3) }).recordCheck(
        'skipped',
        RECEIVED_AT,
      ),
      costedRecord('run_2', { amount: 3, endedAt: at(2) }).recordCheck(
        'failed',
        RECEIVED_AT,
      ),
    ];

    expect(readingOf(checks, records, [])).toEqual(through('run_2', 1));
    expect(readingOf(cost, records, [])).toEqual(through('run_2', 3));
  });
});

describe('measureAround', () => {
  it('measures each run’s window, from twice the runs before the firing to as many after', () => {
    const rule = AlertRule.of({
      measure: 'sent_back_rate',
      above: 0.5,
      over: 1,
    });
    const records = [1, 2, 3, 4, 5, 6].map((hour) =>
      hour === 4
        ? sentBack(`run_${hour}`, hour)
        : accepted(`run_${hour}`, hour),
    );

    const points = measureAround(
      rule,
      { runId: RunId.of('run_4'), value: 1 },
      records,
      [],
    );

    expect(points.map((each) => [each.runId, each.value])).toEqual([
      ['run_2', 0],
      ['run_3', 0],
      ['run_4', 1],
      ['run_5', 0],
    ]);
  });

  it('pins the alert’s own run to the reading it fired on, whatever its run reads now', () => {
    const rule = AlertRule.of({
      measure: 'sent_back_rate',
      above: 0.5,
      over: 1,
    });
    const records = [1, 2, 3].map((hour) => accepted(`run_${hour}`, hour));

    const points = measureAround(
      rule,
      { runId: RunId.of('run_2'), value: 0.75 },
      records,
      [],
    );

    expect(points.map((each) => [each.runId, each.value])).toEqual([
      ['run_1', 0],
      ['run_2', 0.75],
      ['run_3', 0],
    ]);
  });
});
