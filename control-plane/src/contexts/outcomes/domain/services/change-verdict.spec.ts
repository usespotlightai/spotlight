import { deliveredOf } from '@outcomes/domain/insights.fake-spec';
import { costedRecord, endedRecord } from '@outcomes/domain/outcomes.fake-spec';
import {
  changeVerdictOf,
  type MeasureVerdict,
} from '@outcomes/domain/services/change-verdict';
import type { AlertMeasure } from '@outcomes/domain/value-objects/alert-rule.vo';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { describe, expect, it } from 'vitest';

const at = (hour: number) =>
  new Date(`2026-09-30T${String(hour).padStart(2, '0')}:00:00.000Z`);

const actedOn = (runId: string, hour: number, act: 'closed' | 'sent-back') =>
  endedRecord(runId, { taskId: `task_${runId}`, endedAt: at(hour) }).actedOn(
    NextAct.of(act, at(hour)),
  );

const runs = (prefix: string, acts: readonly ('closed' | 'sent-back')[]) =>
  acts.map((act, index) => actedOn(`${prefix}${index}`, index + 1, act));

const of = (
  verdicts: readonly MeasureVerdict[],
  measure: AlertMeasure,
): MeasureVerdict | undefined =>
  verdicts.find((each) => each.measure === measure);

const FIVE_CLOSED = ['closed', 'closed', 'closed', 'closed', 'closed'] as const;

describe('changeVerdictOf', () => {
  it('calls a measure better or worse only from enough settled runs on each side', () => {
    const before = runs('b', [
      'closed',
      'sent-back',
      'sent-back',
      'sent-back',
      'closed',
    ]);
    const after = runs('a', FIVE_CLOSED);

    const verdicts = changeVerdictOf(before, after, []);

    expect(of(verdicts, 'accepted_rate')).toMatchObject({
      before: 0.4,
      after: 1,
      settledBefore: 5,
      settledAfter: 5,
      verdict: 'better',
    });
    expect(of(verdicts, 'sent_back_rate')?.verdict).toBe('better');
    expect(of(verdicts, 'failed_rate')?.verdict).toBe('unchanged');
  });

  it('says too few runs settled rather than guess, leaving out runs nobody answered yet', () => {
    const before = runs('b', FIVE_CLOSED);
    const after = [
      ...runs('a', ['sent-back', 'sent-back', 'sent-back', 'sent-back']),
      endedRecord('a_open', { taskId: 'task_open', endedAt: at(9) }),
    ];

    const verdicts = changeVerdictOf(before, after, []);

    expect(of(verdicts, 'accepted_rate')).toMatchObject({
      after: 0,
      settledAfter: 4,
      verdict: 'insufficient',
    });
    expect(of(verdicts, 'failed_rate')?.settledAfter).toBe(5);
  });

  it('counts a run that failed provisioning as a failed run on its side', () => {
    const unstarted = (runId: string, hour: number) =>
      endedRecord(runId, {
        taskId: `task_${runId}`,
        ending: 'failed',
        failure: 'provisioning',
        endedAt: at(hour),
      });
    const before = runs('b', FIVE_CLOSED);
    const after = [
      ...runs('a', FIVE_CLOSED),
      unstarted('a_unstarted_1', 7),
      unstarted('a_unstarted_2', 8),
    ];

    expect(of(changeVerdictOf(before, after, []), 'failed_rate')).toMatchObject(
      {
        before: 0,
        after: 2 / 7,
        settledBefore: 5,
        settledAfter: 7,
        verdict: 'worse',
      },
    );
    expect(of(changeVerdictOf(after, before, []), 'failed_rate')?.verdict).toBe(
      'better',
    );
  });

  it('reads merging as a rate of tasks whose pull request closed', () => {
    const before = runs('b', FIVE_CLOSED);
    const after = runs('a', FIVE_CLOSED);
    const deliveries = [
      ...before.map((each, index) =>
        deliveredOf(each.taskId?.value ?? '', {
          openedAt: at(1),
          closedAt: at(2),
          merged: index < 4,
        }),
      ),
      ...after.map((each, index) =>
        deliveredOf(each.taskId?.value ?? '', {
          openedAt: at(1),
          closedAt: index < 4 ? at(2) : undefined,
          merged: index < 2,
        }),
      ),
    ];

    const merged = of(
      changeVerdictOf(before, after, deliveries),
      'merged_rate',
    );

    expect(merged).toMatchObject({
      before: 0.8,
      after: 0.5,
      settledAfter: 4,
      verdict: 'insufficient',
    });
  });

  it('weighs cost only between runs priced in one currency', () => {
    const priced = (prefix: string, amount: number, currency: string) =>
      [0, 1, 2, 3, 4].map((index) =>
        costedRecord(`${prefix}${index}`, {
          amount,
          currency,
          endedAt: at(index + 1),
        }),
      );

    expect(
      of(
        changeVerdictOf(priced('b', 2, 'USD'), priced('a', 1, 'USD'), []),
        'cost_per_run',
      ),
    ).toMatchObject({
      before: 2,
      after: 1,
      currency: 'USD',
      verdict: 'better',
    });
    expect(
      of(
        changeVerdictOf(priced('b', 2, 'USD'), priced('a', 1, 'EUR'), []),
        'cost_per_run',
      )?.verdict,
    ).toBe('insufficient');
  });
});
