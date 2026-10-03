import {
  PairJudging,
  type PairShown,
} from '@outcomes/domain/aggregates/pair-judging.aggregate';
import type { PairJudged } from '@outcomes/domain/events/pair-judged.event';
import type { PairJudgingFailed } from '@outcomes/domain/events/pair-judging-failed.event';
import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import { claimsCriteria } from '@outcomes/domain/judging.fake-spec';
import { PairEvidence } from '@outcomes/domain/services/pair-evidence';
import { JudgingFailure } from '@outcomes/domain/value-objects/judging-failure.vo';
import type { PairOrder } from '@outcomes/domain/value-objects/pair-order';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-03T10:00:00.000Z');

const RUN = RunId.of('replay_1');

const AGAINST = RunId.of('replay_2');

const asked = () =>
  PairJudging.asked({
    runId: RUN,
    against: AGAINST,
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    criteria: claimsCriteria(),
    reference: RunId.of('original_1'),
    mostAttempts: 2,
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
    against: { run: AGAINST, hunks: [hunk('+drain()')] },
    order,
    title: 'Drain',
    description: null,
    reference: [hunk('+drainInOrder()')],
  });

const runLabelIn = (order: PairOrder) =>
  order === 'run-first' ? ('A' as const) : ('B' as const);

const preferring = (
  judging: PairJudging,
  prefer: (order: PairOrder) => 'A' | 'B' | 'tie',
  reasons = (order: PairOrder) => [
    { text: 'It drains fast.', hunks: [`${runLabelIn(order)}:api/q.ts#1`] },
  ],
): readonly PairShown[] =>
  judging.orders.map((order) => ({
    verdict: { preferred: prefer(order), reasons: reasons(order) },
    evidence: evidenceIn(order),
  }));

const leased = () => asked().leased(NOW);

describe('PairJudging', () => {
  it('sets two different runs beside a third, accepted before', () => {
    expect(() =>
      PairJudging.asked({
        runId: RUN,
        against: RUN,
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        criteria: claimsCriteria(),
        reference: RunId.of('original_1'),
        mostAttempts: 2,
        now: NOW,
      }),
    ).toThrow(InvalidScoreError);
    expect(() =>
      PairJudging.asked({
        runId: RUN,
        against: AGAINST,
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        criteria: claimsCriteria(),
        reference: AGAINST,
        mostAttempts: 2,
        now: NOW,
      }),
    ).toThrow(InvalidScoreError);
    expect(asked().owesWork).toBe(true);
  });

  it('reads the pair once in the order drawn and once the other way round', () => {
    const judging = leased();

    expect(judging.orders).toEqual([
      judging.order,
      judging.order === 'run-first' ? 'against-first' : 'run-first',
    ]);
  });

  it('names the winner by its run when both readings agree, whatever label it was shown under, keeping both readings', () => {
    const judging = leased().usedModel({
      inputTokens: 100,
      outputTokens: 10,
      cost: { amount: 0.02, currency: 'USD' },
    });
    const judged = judging.judged({
      readings: preferring(judging, runLabelIn),
      model: 'some/model',
      now: NOW,
    });
    const [event] = judged.pullEvents() as PairJudged[];

    expect(judged.owesWork).toBe(false);
    expect(event?.winner).toBe('run');
    expect(event?.readings.map((each) => each.winner)).toEqual(['run', 'run']);
    expect(event?.readings.map((each) => each.runShownFirst)).toEqual([
      judging.order === 'run-first',
      judging.order !== 'run-first',
    ]);
    expect(event?.readings[0]?.reasons[0]?.runHunks).toEqual(['api/q.ts#1']);
    expect(event?.spent.costs).toEqual([{ amount: 0.02, currency: 'USD' }]);
  });

  it('calls the pair a tie where the two readings disagree, as when the judge always prefers what it saw first', () => {
    const judging = leased();
    const [event] = judging
      .judged({
        readings: preferring(judging, () => 'A'),
        model: 'some/model',
        now: NOW,
      })
      .pullEvents() as PairJudged[];

    expect(event?.winner).toBe('tie');
    expect(event?.readings.map((each) => each.winner).sort()).toEqual([
      'against',
      'run',
    ]);
  });

  it('tries again later when either reading rests on nothing shown, or gives no reason', () => {
    const judging = leased();

    for (const reasons of [
      () => [],
      () => [{ text: 'Like the reference.', hunks: ['reference:api/q.ts#1'] }],
    ]) {
      const tried = judging.judged({
        readings: preferring(judging, runLabelIn, reasons),
        model: 'some/model',
        now: NOW,
      });

      expect(tried.owesWork).toBe(true);
      expect(tried.pullEvents()).toEqual([]);
    }
  });

  it('is judged only on its own two runs’ changes, shown both ways round', () => {
    const judging = leased();
    const [first] = preferring(judging, runLabelIn);

    expect(() =>
      judging.judged({
        readings: [first as PairShown, first as PairShown],
        model: 'some/model',
        now: NOW,
      }),
    ).toThrow(InvalidScoreError);
    expect(() =>
      judging.judged({
        readings: [first as PairShown],
        model: 'some/model',
        now: NOW,
      }),
    ).toThrow(InvalidScoreError);
  });

  it('says it failed for good, with what it spent, once it can try no more', () => {
    const failed = leased().failed(JudgingFailure.of('no-evidence', NOW));
    const [event] = failed.pullEvents() as PairJudgingFailed[];

    expect(failed.owesWork).toBe(false);
    expect(event?.failure.code).toBe('no-evidence');
    expect(event?.against.equals(AGAINST)).toBe(true);
  });

  it('stops trying once it was tried as often as its asker pays for', () => {
    const once = PairJudging.asked({
      runId: RUN,
      against: AGAINST,
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      criteria: claimsCriteria(),
      reference: RunId.of('original_1'),
      mostAttempts: 1,
      now: NOW,
    }).leased(NOW);

    const failed = once.failed(JudgingFailure.of('errored', NOW));

    expect(failed.owesWork).toBe(false);
    expect(leased().failed(JudgingFailure.of('errored', NOW)).owesWork).toBe(
      true,
    );
  });
});
