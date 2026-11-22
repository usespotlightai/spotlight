import type { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import {
  runTally,
  tallyCountedOf,
  tallyDeltasOf,
  tallyRatesOf,
  tallySeenOf,
} from '@insights/domain/services/run-tally';
import { PersonAction } from '@insights/domain/value-objects/person-action.vo';
import { StationPass } from '@insights/domain/value-objects/station-pass.vo';
import { ownedRecordOf } from '@insights/insights.fake-spec';
import {
  checkOf,
  costedRecord,
  endedRecord,
  factsWith,
} from '@insights/runs.fake-spec';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const ACTOR = UserId.of('user_actor');

const RECEIVED_AT = new Date('2026-09-30T12:00:00.000Z');

const AT = new Date('2026-09-30T12:00:00.000Z');

const merged = (taskId: string) =>
  ownedRecordOf(taskId, { openedAt: AT, closedAt: AT, merged: true });

const tallyWith = (
  records: readonly RunRecord[],
  pullRequests: readonly PullRequestRecord[],
) => runTally(factsWith(records, pullRequests));

describe('runTally', () => {
  it('counts how the runs ended and what people did next, never counting an answered approval as accepting or sending back', () => {
    const tally = tallyWith(
      [
        endedRecord('run_1', { ending: 'failed', failure: 'exited' })
          .recordCheck(checkOf('failed', RECEIVED_AT))
          .recordAction(PersonAction.of('sent-back', AT, ACTOR)),
        endedRecord('run_2', { ending: 'stopped' }),
        endedRecord('run_3')
          .recordCheck(checkOf('passed', RECEIVED_AT))
          .recordAction(PersonAction.of('approved', AT, ACTOR)),
        endedRecord('run_4')
          .recordCheck(checkOf('skipped', RECEIVED_AT))
          .recordAction(PersonAction.of('accepted', AT, ACTOR)),
        endedRecord('run_5').recordAction(
          PersonAction.of('dismissed', AT, ACTOR),
        ),
      ],
      [],
    );

    expect(tally).toMatchObject({
      runs: 5,
      cancelled: 0,
      failed: 1,
      failedRate: 0.2,
      stopped: 1,
      checksPassed: 1,
      checksFailed: 1,
      resolutions: {
        accepted: 1,
        sentBack: 1,
        movedOn: 0,
        failed: 0,
        other: 3,
      },
      passed: 0,
      merged: 0,
    });
  });

  it('gives each run one resolution, from people’s verdict first, a merge accepting only a completed run that stayed at its station, and an accept passing no failed run', () => {
    const tally = tallyWith(
      [
        endedRecord('run_1', { taskId: 'task_1' }),
        endedRecord('run_2', { taskId: 'task_2' }).passTo(
          StationPass.of(StationId.of('station_2'), AT),
        ),
        endedRecord('run_3', { taskId: 'task_3' }).recordAction(
          PersonAction.of('started', AT, ACTOR),
        ),
        endedRecord('run_4', { taskId: 'task_4', ending: 'stopped' }),
        endedRecord('run_5', { taskId: 'task_5' }).recordAction(
          PersonAction.of('sent-back', AT, ACTOR),
        ),
        endedRecord('run_6', { taskId: 'task_6', ending: 'failed' }),
        endedRecord('run_7', { taskId: 'task_7' }),
        endedRecord('run_8', {
          taskId: 'task_8',
          ending: 'failed',
        }).recordAction(PersonAction.of('accepted', AT, ACTOR)),
      ],
      [merged('task_1'), merged('task_2'), merged('task_4'), merged('task_5')],
    );

    expect(tally).toMatchObject({
      runs: 8,
      failed: 2,
      resolutions: {
        accepted: 1,
        sentBack: 1,
        movedOn: 2,
        failed: 2,
        other: 2,
      },
      resolutionShares: {
        accepted: 0.125,
        sentBack: 0.125,
        movedOn: 0.25,
        failed: 0.25,
        other: 0.25,
      },
      merged: 4,
    });
  });

  it('counts the runs that passed their task to another station', () => {
    const tally = tallyWith(
      [
        endedRecord('run_1').passTo(
          StationPass.of(StationId.of('station_2'), AT),
        ),
        endedRecord('run_2').passTo(
          StationPass.of(StationId.of('station_3'), AT),
        ),
        endedRecord('run_3'),
        endedRecord('run_4', { ending: 'cancelled' }).passTo(
          StationPass.of(StationId.of('station_2'), AT),
        ),
      ],
      [],
    );

    expect(tally.passed).toBe(2);
  });

  it('counts cancelled runs apart, and leaves them out of everything else', () => {
    const tally = tallyWith(
      [
        costedRecord('run_1', { ending: 'cancelled', ms: 1, amount: 9 })
          .supersededByItsTask(RECEIVED_AT)
          .recordAction(PersonAction.of('accepted', AT, ACTOR)),
        costedRecord('run_2', { ending: 'failed', ms: 40_000, amount: 0.5 }),
      ],
      [],
    );

    expect(tally).toMatchObject({
      runs: 1,
      cancelled: 1,
      failed: 1,
      resolutions: {
        accepted: 0,
        sentBack: 0,
        movedOn: 0,
        failed: 1,
        other: 0,
      },
      cost: { amount: 0.5, currency: 'USD' },
      medianMs: 40_000,
      p90Ms: 40_000,
    });
  });

  it('counts each task whose pull requests all merged once, however many runs it needed', () => {
    const tally = tallyWith(
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
    const tally = tallyWith(
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
    const tally = tallyWith(
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
    const tally = tallyWith(
      [
        costedRecord('run_1', { ms: 10_000 }),
        costedRecord('run_2', { ms: 20_000 }),
      ],
      [],
    );

    expect(tally.medianMs).toBe(15_000);
  });

  it('takes the time nine in ten runs stayed within as the ninetieth percentile', () => {
    const tally = tallyWith(
      Array.from({ length: 10 }, (_, at) =>
        costedRecord(`run_${at}`, { ms: (at + 1) * 1_000 }),
      ),
      [],
    );

    expect(tally.medianMs).toBe(5_500);
    expect(tally.p90Ms).toBe(9_000);
  });

  it('tallies nothing without runs', () => {
    expect(tallyWith([], [])).toEqual({
      runs: 0,
      cancelled: 0,
      failed: 0,
      failedRate: null,
      stopped: 0,
      checksPassed: 0,
      checksFailed: 0,
      resolutions: {
        accepted: 0,
        sentBack: 0,
        movedOn: 0,
        failed: 0,
        other: 0,
      },
      resolutionShares: {
        accepted: null,
        sentBack: null,
        movedOn: null,
        failed: null,
        other: null,
      },
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

describe('tallyDeltasOf', () => {
  const tallied = (failures: number, others: number) =>
    tallyWith(
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
    const changes = tallyDeltasOf(tallied(1, 5), tallied(2, 2));

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
    const now = tallyWith(
      [
        endedRecord('run_1').recordAction(
          PersonAction.of('accepted', AT, ACTOR),
        ),
      ],
      [],
    );
    const before = tallyWith(
      [
        endedRecord('run_2').recordAction(
          PersonAction.of('sent-back', AT, ACTOR),
        ),
      ],
      [],
    );

    expect(tallySeenOf(now, before)).toEqual({
      accepted: true,
      sentBack: true,
      merged: false,
    });
  });
});

describe('tallyRatesOf', () => {
  it('shares checks passed among runs checked, and merges among runs', () => {
    const tally = tallyWith(
      [
        endedRecord('run_1', { taskId: 'task_1' })
          .recordCheck(checkOf('passed', AT))
          .recordAction(PersonAction.of('accepted', AT, ACTOR)),
        endedRecord('run_2', { taskId: 'task_2' }).recordCheck(
          checkOf('failed', AT),
        ),
        endedRecord('run_3', { taskId: 'task_3' }),
        endedRecord('run_4', { taskId: 'task_4' }),
      ],
      [merged('task_1')],
    );

    expect(tallyRatesOf(tally)).toEqual({
      checksPassed: 0.5,
      merged: 0.25,
    });
  });

  it('has no shares where nothing ran or nothing was checked', () => {
    expect(tallyRatesOf(tallyWith([], []))).toEqual({
      checksPassed: null,
      merged: null,
    });
  });
});

describe('tallyCountedOf', () => {
  it('marks the counts above zero', () => {
    expect(
      tallyCountedOf(
        tallyWith(
          [
            endedRecord('run_1', { ending: 'failed' }),
            endedRecord('run_2').recordAction(
              PersonAction.of('sent-back', AT, ACTOR),
            ),
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
