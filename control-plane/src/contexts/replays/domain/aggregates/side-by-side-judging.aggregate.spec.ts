import { SideBySideJudging } from '@replays/domain/aggregates/side-by-side-judging.aggregate';
import type { SideBySideJudged } from '@replays/domain/events/side-by-side-judged.event';
import type { SideBySideJudgingFailed } from '@replays/domain/events/side-by-side-judging-failed.event';
import { InvalidJudgingError } from '@replays/domain/exceptions/invalid-judging.error';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import type {
  JudgedPair,
  PairWinner,
} from '@replays/domain/value-objects/pair-judgment';
import type { PairOrder } from '@replays/domain/value-objects/pair-order';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-03T10:00:00.000Z');

const RUN = RunId.of('replay_1');

const AGAINST = RunId.of('replay_2');

const queued = (maxAttempts = 2) =>
  SideBySideJudging.requested({
    runId: RUN,
    otherRunId: AGAINST,
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    criteria: JudgeCriteria.of({ rubric: null, claims: ['It drains.'] }),
    reference: RunId.of('original_1'),
    maxAttempts,
    now: NOW,
  });

const judged = (
  orders: readonly PairOrder[],
  winners: readonly PairWinner[],
): JudgedPair => ({
  judged: true,
  passes: orders.map((order, at) => ({
    order,
    winner: winners[at] ?? 'tie',
    reasons: [
      { text: 'It drains fast.', runHunks: ['api/q.ts#1'], otherHunks: [] },
    ],
  })),
  model: 'some/model',
  spent: ModelSpent.of([Money.of(0.02, 'USD')], 0),
});

describe('SideBySideJudging', () => {
  it('sets two different runs beside a third, accepted before', () => {
    expect(() =>
      SideBySideJudging.requested({
        runId: RUN,
        otherRunId: RUN,
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        criteria: JudgeCriteria.of({ rubric: 'Good?' }),
        reference: RunId.of('original_1'),
        maxAttempts: 2,
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

  it('names the winner by its run when both passes agree, keeping both passes', () => {
    const judging = queued().leaseJob(NOW);
    const done = judging.recordJudgment(
      judged(judging.orders, ['run', 'run']),
      NOW,
    );
    const [event] = done.pullEvents() as SideBySideJudged[];

    expect(done.hasPendingJob).toBe(false);
    expect(event?.verdict.outcome).toBe('win');
    expect(event?.verdict.passes.map((each) => each.ownShownFirst)).toEqual([
      judging.order === 'run-first',
      judging.order !== 'run-first',
    ]);
    expect(event?.verdict.passes[0]?.reasons[0]?.ownHunks).toEqual([
      'api/q.ts#1',
    ]);
  });

  it('calls the pair a tie where the two passes disagree', () => {
    const judging = queued().leaseJob(NOW);
    const [event] = judging
      .recordJudgment(judged(judging.orders, ['run', 'other']), NOW)
      .pullEvents() as SideBySideJudged[];

    expect(event?.verdict.outcome).toBe('tie');
  });

  it('refuses passes read in other orders than its own', () => {
    const judging = queued().leaseJob(NOW);

    expect(() =>
      judging.recordJudgment(
        judged([...judging.orders].reverse(), ['run', 'run']),
        NOW,
      ),
    ).toThrow(InvalidJudgingError);
  });

  it('gives up once it used the attempts paid for', () => {
    const [event] = queued(1)
      .leaseJob(NOW)
      .recordJudgment(
        {
          judged: false,
          failure: 'ungrounded',
          spent: ModelSpent.of([Money.of(0.01, 'USD')], 0),
        },
        NOW,
      )
      .pullEvents() as SideBySideJudgingFailed[];

    expect(event?.failure.code).toBe('ungrounded');
  });
});
