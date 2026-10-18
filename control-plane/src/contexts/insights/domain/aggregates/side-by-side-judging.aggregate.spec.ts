import {
  type PairShown,
  SideBySideJudging,
} from '@insights/domain/aggregates/side-by-side-judging.aggregate';
import type { SideBySideJudged } from '@insights/domain/events/side-by-side-judged.event';
import type { SideBySideJudgingFailed } from '@insights/domain/events/side-by-side-judging-failed.event';
import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';
import { claimsCriteria } from '@insights/domain/judging.fake-spec';
import { PairEvidence } from '@insights/domain/services/pair-evidence';
import { JudgingFailure } from '@insights/domain/value-objects/judging-failure.vo';
import type { PairOrder } from '@insights/domain/value-objects/pair-order';
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
    criteria: claimsCriteria(),
    reference: RunId.of('original_1'),
    maxAttempts: 2,
    now: NOW,
  });

const hunk = (line: string) => ({
  id: 'api/q.ts#1',
  path: 'api/q.ts',
  header: '@@ -1 +1 @@',
  lines: [line],
});

const evidenceIn = (order: PairOrder) =>
  PairEvidence.of({
    run: { run: RUN, hunks: [hunk('+drainFast()')] },
    other: { run: AGAINST, hunks: [hunk('+drain()')] },
    order,
    title: 'Drain',
    description: null,
    reference: [hunk('+drainInOrder()')],
  });

const runLabelIn = (order: PairOrder) =>
  order === 'run-first' ? ('A' as const) : ('B' as const);

const preferring = (
  judging: SideBySideJudging,
  prefer: (order: PairOrder) => 'A' | 'B' | 'tie',
  reasons = (order: PairOrder) => [
    { text: 'It drains fast.', hunks: [`${runLabelIn(order)}:api/q.ts#1`] },
  ],
): readonly PairShown[] =>
  judging.orders.map((order) => ({
    verdict: { preferred: prefer(order), reasons: reasons(order) },
    evidence: evidenceIn(order),
  }));

const leasedJudging = () => queued().leaseJob(NOW);

describe('SideBySideJudging', () => {
  it('sets two different runs beside a third, accepted before', () => {
    expect(() =>
      SideBySideJudging.requested({
        runId: RUN,
        otherRunId: RUN,
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        criteria: claimsCriteria(),
        reference: RunId.of('original_1'),
        maxAttempts: 2,
        now: NOW,
      }),
    ).toThrow(InvalidScoreError);
    expect(() =>
      SideBySideJudging.requested({
        runId: RUN,
        otherRunId: AGAINST,
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        criteria: claimsCriteria(),
        reference: AGAINST,
        maxAttempts: 2,
        now: NOW,
      }),
    ).toThrow(InvalidScoreError);
    expect(queued().hasPendingJob).toBe(true);
  });

  it('reads the pair once in the order drawn and once the other way round', () => {
    const judging = leasedJudging();

    expect(judging.orders).toEqual([
      judging.order,
      judging.order === 'run-first' ? 'other-first' : 'run-first',
    ]);
  });

  it('names the winner by its run when both passes agree, whatever label it was shown under, keeping both passes', () => {
    const judging = leasedJudging().recordModel({
      inputTokens: 100,
      outputTokens: 10,
      cost: { amount: 0.02, currency: 'USD' },
    });
    const judged = judging.recordVerdict({
      passes: preferring(judging, runLabelIn),
      model: 'some/model',
      now: NOW,
    });
    const [event] = judged.pullEvents() as SideBySideJudged[];

    expect(judged.hasPendingJob).toBe(false);
    expect(event?.winner).toBe('run');
    expect(event?.passes.map((each) => each.winner)).toEqual(['run', 'run']);
    expect(event?.passes.map((each) => each.runShownFirst)).toEqual([
      judging.order === 'run-first',
      judging.order !== 'run-first',
    ]);
    expect(event?.passes[0]?.reasons[0]?.runHunks).toEqual(['api/q.ts#1']);
    expect(event?.spent.costs).toEqual([{ amount: 0.02, currency: 'USD' }]);
  });

  it('calls the pair a tie where the two passes disagree, as when the judge always prefers what it saw first', () => {
    const judging = leasedJudging();
    const [event] = judging
      .recordVerdict({
        passes: preferring(judging, () => 'A'),
        model: 'some/model',
        now: NOW,
      })
      .pullEvents() as SideBySideJudged[];

    expect(event?.winner).toBe('tie');
    expect(event?.passes.map((each) => each.winner).sort()).toEqual([
      'other',
      'run',
    ]);
  });

  it('retries later when either pass rests on nothing shown, or gives no reason', () => {
    const judging = leasedJudging();

    for (const reasons of [
      () => [],
      () => [{ text: 'Like the reference.', hunks: ['reference:api/q.ts#1'] }],
    ]) {
      const tried = judging.recordVerdict({
        passes: preferring(judging, runLabelIn, reasons),
        model: 'some/model',
        now: NOW,
      });

      expect(tried.hasPendingJob).toBe(true);
      expect(tried.pullEvents()).toEqual([]);
    }
  });

  it('is judged only on its own two runs’ changes, shown both ways round', () => {
    const judging = leasedJudging();
    const [first] = preferring(judging, runLabelIn);

    expect(() =>
      judging.recordVerdict({
        passes: [first as PairShown, first as PairShown],
        model: 'some/model',
        now: NOW,
      }),
    ).toThrow(InvalidScoreError);
    expect(() =>
      judging.recordVerdict({
        passes: [first as PairShown],
        model: 'some/model',
        now: NOW,
      }),
    ).toThrow(InvalidScoreError);
  });

  it('says it failed for good, with what it spent, once it can try no more', () => {
    const failed = leasedJudging().failed(
      JudgingFailure.of('no-evidence', NOW),
    );
    const [event] = failed.pullEvents() as SideBySideJudgingFailed[];

    expect(failed.hasPendingJob).toBe(false);
    expect(event?.failure.code).toBe('no-evidence');
    expect(event?.otherRunId.equals(AGAINST)).toBe(true);
  });

  it('stops trying once it was tried as often as its requester pays for', () => {
    const once = SideBySideJudging.requested({
      runId: RUN,
      otherRunId: AGAINST,
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      criteria: claimsCriteria(),
      reference: RunId.of('original_1'),
      maxAttempts: 1,
      now: NOW,
    }).leaseJob(NOW);

    const failed = once.failed(JudgingFailure.of('errored', NOW));

    expect(failed.hasPendingJob).toBe(false);
    expect(
      leasedJudging().failed(JudgingFailure.of('errored', NOW)).hasPendingJob,
    ).toBe(true);
  });
});
