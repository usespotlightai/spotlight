import { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import {
  costedRecord,
  endedRecord,
  TEAM,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { runTally } from '@outcomes/domain/services/run-tally';
import { HandedOn } from '@outcomes/domain/value-objects/handed-on.vo';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const HEARD_AT = new Date('2026-09-30T12:00:00.000Z');

const AT = new Date('2026-09-30T12:00:00.000Z');
const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/1');

const merged = (taskId: string) =>
  TaskDelivery.opened({
    taskId: TaskId.of(taskId),
    workspaceId: WORKSPACE,
    teamId: TEAM,
    pullRequest: PULL,
    at: AT,
  }).closed({ pullRequest: PULL, merged: true, at: AT });

describe('runTally', () => {
  it('counts how the runs ended and what people did next', () => {
    const tally = runTally(
      [
        endedRecord('run_1', { ending: 'failed', failure: 'exited' })
          .checked('failed', HEARD_AT)
          .actedOn(NextAct.of('sent-back', AT)),
        endedRecord('run_2', { ending: 'stopped' }),
        endedRecord('run_3')
          .checked('passed', HEARD_AT)
          .actedOn(NextAct.of('approved', AT)),
        endedRecord('run_4')
          .checked('skipped', HEARD_AT)
          .actedOn(NextAct.of('closed', AT)),
        endedRecord('run_5').actedOn(NextAct.of('refused', AT)),
      ],
      [],
    );

    expect(tally).toMatchObject({
      runs: 5,
      withdrawn: 0,
      failed: 1,
      stopped: 1,
      checksPassed: 1,
      checksFailed: 1,
      accepted: 2,
      sentBack: 2,
      handedOn: 0,
      merged: 0,
    });
  });

  it('counts the runs that moved their task on to another station', () => {
    const tally = runTally(
      [
        endedRecord('run_1').handedOnTo(HandedOn.of('station_2', AT)),
        endedRecord('run_2').handedOnTo(HandedOn.of('station_3', AT)),
        endedRecord('run_3'),
        endedRecord('run_4', { ending: 'withdrawn' }).handedOnTo(
          HandedOn.of('station_2', AT),
        ),
      ],
      [],
    );

    expect(tally.handedOn).toBe(2);
  });

  it('counts withdrawn runs apart, and leaves them out of everything else', () => {
    const tally = runTally(
      [
        costedRecord('run_1', { ending: 'withdrawn', ms: 1, amount: 9 })
          .supersededByItsTask(HEARD_AT)
          .actedOn(NextAct.of('closed', AT)),
        costedRecord('run_2', { ending: 'failed', ms: 40_000, amount: 0.5 }),
      ],
      [],
    );

    expect(tally).toMatchObject({
      runs: 1,
      withdrawn: 1,
      failed: 1,
      accepted: 0,
      cost: { amount: 0.5, currency: 'USD' },
      medianMs: 40_000,
      p90Ms: 40_000,
    });
  });

  it('counts each task whose pull request merged once, however many runs it took', () => {
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
      withdrawn: 0,
      failed: 0,
      stopped: 0,
      checksPassed: 0,
      checksFailed: 0,
      accepted: 0,
      sentBack: 0,
      handedOn: 0,
      merged: 0,
      cost: null,
      unpriced: 0,
      mixedCurrencies: false,
      medianMs: null,
      p90Ms: null,
    });
  });
});
