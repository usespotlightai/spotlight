import { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import {
  costedRecord,
  endedRecord,
  TEAM,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import {
  runTally,
  tallyChangesOf,
  tallyCountedOf,
  tallySeenOf,
  tallySharesOf,
} from '@outcomes/domain/services/run-tally';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { StationPass } from '@outcomes/domain/value-objects/station-pass.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const RECEIVED_AT = new Date('2026-09-30T12:00:00.000Z');

const AT = new Date('2026-09-30T12:00:00.000Z');
const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/1');

const merged = (taskId: string) =>
  TaskDelivery.open({
    taskId: TaskId.of(taskId),
    workspaceId: WORKSPACE,
    teamId: TEAM,
    pullRequest: PULL,
    at: AT,
  }).close({ pullRequest: PULL, merged: true, at: AT });

describe('runTally', () => {
  it('counts how the runs ended and what people did next, never counting an answered approval as accepting or sending back', () => {
    const tally = runTally(
      [
        endedRecord('run_1', { ending: 'failed', failure: 'exited' })
          .recordCheck('failed', RECEIVED_AT)
          .recordAction(NextAct.of('sent-back', AT)),
        endedRecord('run_2', { ending: 'stopped' }),
        endedRecord('run_3')
          .recordCheck('passed', RECEIVED_AT)
          .recordAction(NextAct.of('approved', AT)),
        endedRecord('run_4')
          .recordCheck('skipped', RECEIVED_AT)
          .recordAction(NextAct.of('closed', AT)),
        endedRecord('run_5').recordAction(NextAct.of('refused', AT)),
      ],
      [],
    );

    expect(tally).toMatchObject({
      runs: 5,
      cancelled: 0,
      failed: 1,
      failedShare: 0.2,
      stopped: 1,
      checksPassed: 1,
      checksFailed: 1,
      accepted: 1,
      sentBack: 1,
      passed: 0,
      merged: 0,
    });
  });

  it('counts the runs that passed their task to another station', () => {
    const tally = runTally(
      [
        endedRecord('run_1').passTo(StationPass.of('station_2', AT)),
        endedRecord('run_2').passTo(StationPass.of('station_3', AT)),
        endedRecord('run_3'),
        endedRecord('run_4', { ending: 'cancelled' }).passTo(
          StationPass.of('station_2', AT),
        ),
      ],
      [],
    );

    expect(tally.passed).toBe(2);
  });

  it('counts cancelled runs apart, and leaves them out of everything else', () => {
    const tally = runTally(
      [
        costedRecord('run_1', { ending: 'cancelled', ms: 1, amount: 9 })
          .supersededByItsTask(RECEIVED_AT)
          .recordAction(NextAct.of('closed', AT)),
        costedRecord('run_2', { ending: 'failed', ms: 40_000, amount: 0.5 }),
      ],
      [],
    );

    expect(tally).toMatchObject({
      runs: 1,
      cancelled: 1,
      failed: 1,
      accepted: 0,
      cost: { amount: 0.5, currency: 'USD' },
      medianMs: 40_000,
      p90Ms: 40_000,
    });
  });

  it('counts each task whose pull request merged once, however many runs it needed', () => {
    const tally = runTally(
      [
        endedRecord('run_1', { taskId: 'task_1' }),
        endedRecord('run_2', { taskId: 'task_1' }),
        endedRecord('run_3', { taskId: 'task_2' }),
      ],
      [merged('task_1'), merged('task_9')],
    );

    expect(tally.merged).toBe(1);
  });

  it('adds up what the runs cost in one currency, and takes their median time', () => {
    const tally = runTally(
      [
        costedRecord('run_1', { amount: 0.5, ms: 10_000 }),
        costedRecord('run_2', { amount: 1.25, ms: 30_000 }),
        costedRecord('run_3', { amount: null, ms: 20_000 }),
        endedRecord('run_4'),
      ],
      [],
    );

    expect(tally.cost).toEqual({ amount: 1.75, currency: 'USD' });
    expect(tally.unpriced).toBe(2);
    expect(tally.mixedCurrencies).toBe(false);
    expect(tally.medianMs).toBe(20_000);
  });

  it('gives no total for runs that cost different currencies, saying they are mixed rather than unpriced', () => {
    const tally = runTally(
      [
        costedRecord('run_1', { currency: 'USD' }),
        costedRecord('run_2', { currency: 'EUR' }),
      ],
      [],
    );

    expect(tally.cost).toBeNull();
    expect(tally.mixedCurrencies).toBe(true);
    expect(tally.unpriced).toBe(0);
  });

  it('takes the middle of an even number of times as their mean', () => {
    const tally = runTally(
      [
        costedRecord('run_1', { ms: 10_000 }),
        costedRecord('run_2', { ms: 20_000 }),
      ],
      [],
    );

    expect(tally.medianMs).toBe(15_000);
  });

  it('takes the time nine in ten runs stayed within as the ninetieth percentile', () => {
    const tally = runTally(
      Array.from({ length: 10 }, (_, at) =>
        costedRecord(`run_${at}`, { ms: (at + 1) * 1_000 }),
      ),
      [],
    );

    expect(tally.medianMs).toBe(5_500);
    expect(tally.p90Ms).toBe(9_000);
  });

  it('tallies nothing without runs', () => {
    expect(runTally([], [])).toEqual({
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
  });
});

describe('tallyChangesOf', () => {
  const tallied = (failures: number, others: number) =>
    runTally(
      [
        ...Array.from({ length: failures }, (_, index) =>
          endedRecord(`failed_${index}`, { ending: 'failed' }),
        ),
        ...Array.from({ length: others }, (_, index) =>
          endedRecord(`done_${index}`),
        ),
      ],
      [],
    );

  it('moves each count by a relative percent, with fewer failures good and more runs neither', () => {
    const changes = tallyChangesOf(tallied(1, 5), tallied(2, 2));

    expect(changes.runs).toMatchObject({
      unit: 'percent',
      by: 0.5,
      direction: 'up',
      tone: 'flat',
    });
    expect(changes.failed).toMatchObject({
      by: -0.5,
      direction: 'down',
      tone: 'good',
    });
    expect(changes.merged?.direction).toBe('same');
    expect(changes.median).toBeNull();
    expect(changes.cost).toBeNull();
  });
});

describe('tallySeenOf', () => {
  it('sees a count above zero in either period, and none that stayed at zero in both', () => {
    const now = runTally(
      [endedRecord('run_1').recordAction(NextAct.of('closed', AT))],
      [],
    );
    const before = runTally(
      [endedRecord('run_2').recordAction(NextAct.of('sent-back', AT))],
      [],
    );

    expect(tallySeenOf(now, before)).toEqual({
      accepted: true,
      sentBack: true,
      merged: false,
    });
  });
});

describe('tallySharesOf', () => {
  it('shares checks passed among runs checked, and acceptances and merges among runs', () => {
    const tally = runTally(
      [
        endedRecord('run_1', { taskId: 'task_1' })
          .recordCheck('passed', AT)
          .recordAction(NextAct.of('closed', AT)),
        endedRecord('run_2').recordCheck('failed', AT),
        endedRecord('run_3'),
        endedRecord('run_4'),
      ],
      [merged('task_1')],
    );

    expect(tallySharesOf(tally)).toEqual({
      checksPassed: 0.5,
      accepted: 0.25,
      merged: 0.25,
    });
  });

  it('has no shares where nothing ran or nothing was checked', () => {
    expect(tallySharesOf(runTally([], []))).toEqual({
      checksPassed: null,
      accepted: null,
      merged: null,
    });
  });
});

describe('tallyCountedOf', () => {
  it('marks the counts above zero', () => {
    expect(
      tallyCountedOf(
        runTally(
          [
            endedRecord('run_1', { ending: 'failed' }),
            endedRecord('run_2').recordAction(NextAct.of('sent-back', AT)),
          ],
          [],
        ),
      ),
    ).toEqual({
      failed: true,
      stopped: false,
      checksPassed: false,
      checksFailed: false,
      accepted: false,
      sentBack: true,
      passed: false,
      merged: false,
      cancelled: false,
    });
  });
});
