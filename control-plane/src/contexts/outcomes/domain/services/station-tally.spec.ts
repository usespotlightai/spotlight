import { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import {
  costOf,
  endedRecord,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { stationTally } from '@outcomes/domain/services/station-tally';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import type { RunCost } from '@outcomes/domain/value-objects/run-cost.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-09-30T12:00:00.000Z');
const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/1');
const NO_COSTS = new Map<string, RunCost>();

const merged = (taskId: string) =>
  TaskDelivery.opened({
    taskId: TaskId.of(taskId),
    workspaceId: WORKSPACE,
    pullRequest: PULL,
  }).closed({ pullRequest: PULL, merged: true, at: AT });

describe('stationTally', () => {
  it('counts how the runs ended and what people did next', () => {
    const tally = stationTally(
      [
        endedRecord('run_1', { ending: 'failed', failure: 'exited' })
          .checked('failed')
          .actedOn(NextAct.of('sent-back', AT)),
        endedRecord('run_2', { ending: 'stopped' }),
        endedRecord('run_3')
          .checked('passed')
          .actedOn(NextAct.of('approved', AT)),
        endedRecord('run_4')
          .checked('skipped')
          .actedOn(NextAct.of('closed', AT)),
        endedRecord('run_5').actedOn(NextAct.of('refused', AT)),
      ],
      [],
      NO_COSTS,
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
      merged: 0,
    });
  });

  it('counts withdrawn runs apart, and leaves them out of everything else', () => {
    const tally = stationTally(
      [
        endedRecord('run_1', { ending: 'withdrawn' })
          .supersededByItsTask()
          .actedOn(NextAct.of('closed', AT)),
        endedRecord('run_2', { ending: 'failed' }),
      ],
      [],
      new Map([
        ['run_1', costOf({ ms: 1, amount: 9 })],
        ['run_2', costOf({ ms: 40_000, amount: 0.5 })],
      ]),
    );

    expect(tally).toMatchObject({
      runs: 1,
      withdrawn: 1,
      failed: 1,
      accepted: 0,
      cost: { amount: 0.5, currency: 'USD' },
      medianMs: 40_000,
    });
  });

  it('counts each task whose pull request merged once, however many runs it took', () => {
    const tally = stationTally(
      [
        endedRecord('run_1', { taskId: 'task_1' }),
        endedRecord('run_2', { taskId: 'task_1' }),
        endedRecord('run_3', { taskId: 'task_2' }),
      ],
      [merged('task_1'), merged('task_9')],
      NO_COSTS,
    );

    expect(tally.merged).toBe(1);
  });

  it('adds up what the runs cost in one currency, and takes their median time', () => {
    const tally = stationTally(
      [
        endedRecord('run_1'),
        endedRecord('run_2'),
        endedRecord('run_3'),
        endedRecord('run_4'),
      ],
      [],
      new Map([
        ['run_1', costOf({ amount: 0.5, ms: 10_000 })],
        ['run_2', costOf({ amount: 1.25, ms: 30_000 })],
        ['run_3', costOf({ amount: null, ms: 20_000 })],
      ]),
    );

    expect(tally.cost).toEqual({ amount: 1.75, currency: 'USD' });
    expect(tally.medianMs).toBe(20_000);
  });

  it('gives no total for runs that cost different currencies', () => {
    const tally = stationTally(
      [endedRecord('run_1'), endedRecord('run_2')],
      [],
      new Map([
        ['run_1', costOf({ currency: 'USD' })],
        ['run_2', costOf({ currency: 'EUR' })],
      ]),
    );

    expect(tally.cost).toBeNull();
  });

  it('takes the middle of an even number of times as their mean', () => {
    const tally = stationTally(
      [endedRecord('run_1'), endedRecord('run_2')],
      [],
      new Map([
        ['run_1', costOf({ ms: 10_000 })],
        ['run_2', costOf({ ms: 20_000 })],
      ]),
    );

    expect(tally.medianMs).toBe(15_000);
  });

  it('tallies nothing without runs', () => {
    expect(stationTally([], [], NO_COSTS)).toEqual({
      runs: 0,
      withdrawn: 0,
      failed: 0,
      stopped: 0,
      checksPassed: 0,
      checksFailed: 0,
      accepted: 0,
      sentBack: 0,
      merged: 0,
      cost: null,
      medianMs: null,
    });
  });
});
