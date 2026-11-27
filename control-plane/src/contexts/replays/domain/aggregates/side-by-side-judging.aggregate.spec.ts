import { SideBySideJudging } from '@replays/domain/aggregates/side-by-side-judging.aggregate';
import { SideBySideJudged } from '@replays/domain/events/side-by-side-judged.event';
import { SideBySideJudgingFailed } from '@replays/domain/events/side-by-side-judging-failed.event';
import { InvalidJudgingError } from '@replays/domain/exceptions/invalid-judging.error';
import type { PairOutcome } from '@replays/domain/value-objects/entry-pairing.vo';
import type { JudgedPair } from '@replays/domain/value-objects/pair-judgment';
import type { PairOrder } from '@replays/domain/value-objects/pair-order';
import { instanceOf } from '@shared-kernel/domain/instance-of.fake-spec';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { WAIT_MS } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-03T10:00:00.000Z');

const RUN = RunId.of('replay_1');

const AGAINST = RunId.of('replay_2');

const queued = () =>
  SideBySideJudging.requested({
    runId: RUN,
    otherRunId: AGAINST,
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    criteria: JudgeCriteria.of({ claims: ['It drains.'] }),
    reference: RunId.of('original_1'),
    now: NOW,
  });

const judged = (
  orders: readonly PairOrder[],
  outcomes: readonly PairOutcome[],
): JudgedPair => ({
  judged: true,
  passes: orders.map((order, at) => ({
    ownShownFirst: order === 'run-first',
    outcome: outcomes[at] ?? 'tie',
    reasons: [
      { text: 'It drains fast.', ownHunks: ['api/q.ts#1'], theirHunks: [] },
    ],
  })),
  model: 'some/model',
});

describe('SideBySideJudging', () => {
  it('sets two different runs beside a third, accepted before', () => {
    expect(() =>
      SideBySideJudging.requested({
        runId: RUN,
        otherRunId: RUN,
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        criteria: JudgeCriteria.of({ claims: ['It drains.'] }),
        reference: RunId.of('original_1'),
        now: NOW,
      }),
    ).toThrow(InvalidJudgingError);
    expect(queued().hasPendingJob).toBe(true);
  });

  it('reads the pair once in the order drawn and once the other way round', () => {
    const judging = queued();

    expect(judging.orders).toEqual([
      judging.order,
      judging.order === 'run-first' ? 'other-first' : 'run-first',
    ]);
  });

  it('reads a win for its run when both passes agree, keeping both passes', () => {
    const judging = queued().leaseJob(NOW);
    const done = judging.recordJudgment(
      judged(judging.orders, ['win', 'win']),
      NOW,
    );
    const event = instanceOf(SideBySideJudged, done.pullEvents()[0]);

    expect(done.hasPendingJob).toBe(false);
    expect(event.verdict.outcome).toBe('win');
    expect(event.verdict.passes.map((each) => each.ownShownFirst)).toEqual([
      judging.order === 'run-first',
      judging.order !== 'run-first',
    ]);
    expect(event.verdict.passes[0]?.reasons[0].ownHunks).toEqual([
      'api/q.ts#1',
    ]);
  });

  it('waits for its assist sessions without spending the attempt it leased', () => {
    const at = new Date(NOW.getTime() + 15_000);
    const waiting = queued().leaseJob(NOW).waitJob(at);

    expect(waiting.hasPendingJob).toBe(true);
    expect(waiting.job?.attempts).toBe(0);
    expect(waiting.job?.nextAttemptAt).toEqual(
      new Date(at.getTime() + WAIT_MS),
    );
    expect(waiting.job?.waitingSince).toEqual(at);
  });

  it('calls the pair a tie where the two passes disagree', () => {
    const judging = queued().leaseJob(NOW);
    const event = instanceOf(
      SideBySideJudged,
      judging
        .recordJudgment(judged(judging.orders, ['win', 'loss']), NOW)
        .pullEvents()[0],
    );

    expect(event.verdict.outcome).toBe('tie');
  });

  it('refuses passes read in other orders than its own', () => {
    const judging = queued().leaseJob(NOW);

    expect(() =>
      judging.recordJudgment(
        judged([...judging.orders].reverse(), ['win', 'win']),
        NOW,
      ),
    ).toThrow(InvalidJudgingError);
  });

  it('tries twice, then gives up', () => {
    const ungrounded = { judged: false, failure: 'ungrounded' } as const;
    const once = queued().leaseJob(NOW).recordJudgment(ungrounded, NOW);

    expect(once.hasPendingJob).toBe(true);
    expect(once.pullEvents()).toEqual([]);

    const due = once.job?.nextAttemptAt ?? NOW;
    const event = instanceOf(
      SideBySideJudgingFailed,
      once.leaseJob(due).recordJudgment(ungrounded, due).pullEvents()[0],
    );

    expect(event.failure.code).toBe('ungrounded');
  });

  it('gives up at once when the judge has insufficient credits', () => {
    const broke = { judged: false, failure: 'insufficient-credits' } as const;
    const failed = queued().leaseJob(NOW).recordJudgment(broke, NOW);
    const event = instanceOf(SideBySideJudgingFailed, failed.pullEvents()[0]);

    expect(failed.hasPendingJob).toBe(false);
    expect(event.failure.code).toBe('insufficient-credits');
  });

  it('is deleted by itself, keeping its version for the versioned removal', () => {
    const judging = queued();
    const deleted = judging.delete();

    expect(judging.isDeleted).toBe(false);
    expect(deleted.isDeleted).toBe(true);
    expect(deleted.version).toBe(judging.version);
  });

  it('judges in rounds: a retried try is a new round, a wait is not', () => {
    const leased = queued().leaseJob(NOW);
    const resumed = leased
      .waitJob(NOW)
      .leaseJob(new Date(NOW.getTime() + WAIT_MS));

    expect(leased.round).toMatchObject({
      runId: RUN,
      otherRunId: AGAINST,
      attempt: 1,
    });
    expect(resumed.round.equals(leased.round)).toBe(true);
  });

  it('wakes when a session of the round it waits on settles, and only then', () => {
    const leased = queued().leaseJob(NOW);
    const waiting = leased.waitJob(NOW);
    const at = new Date(NOW.getTime() + 1_000);
    const woken = waiting.wake(leased.round, at);

    expect(woken.job?.nextAttemptAt).toEqual(at);
    expect(woken.wake(leased.round, at)).toBe(woken);
    expect(leased.wake(leased.round, at)).toBe(leased);
  });
});
