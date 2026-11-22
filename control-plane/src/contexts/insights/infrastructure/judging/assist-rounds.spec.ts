import { ClaimsRevisionId } from '@insights/domain/value-objects/claims-revision-id.vo';
import { ClaimsRevisionRound } from '@insights/domain/value-objects/claims-revision-round.vo';
import { JudgingRound } from '@insights/domain/value-objects/judging-round.vo';
import {
  draftingRoundOf,
  draftingSessionOf,
  judgeRoundOf,
  judgeSessionOf,
  pairRoundOf,
  pairSessionOf,
} from '@insights/infrastructure/judging/assist-rounds';
import {
  NEXT_RUBRIC_VERSION,
  RUBRIC_VERSION,
} from '@insights/judging.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_1');

const REVISION = ClaimsRevisionRound.of({
  revisionId: ClaimsRevisionId.of('revision_1'),
  attempt: 2,
});

const settled = (session: { purpose: string; key: string }) => ({
  workspaceId: 'workspace_1',
  ...session,
});

describe('the assist sessions of insights’ rounds', () => {
  it('names a judging round’s session by its run, rubric and try, based on the run', () => {
    const round = JudgingRound.of({
      runId: RUN,
      rubricVersion: RUBRIC_VERSION,
      attempt: 1,
    });

    expect(judgeSessionOf({ of: 'judging', round })).toEqual({
      purpose: 'insights.judge',
      key: `judging:run_1:${RUBRIC_VERSION}:1`,
      basedOnRun: 'run_1',
    });
  });

  it('orders a new session for the same run on a new rubric', () => {
    const keyOn = (rubricVersion: typeof RUBRIC_VERSION) =>
      judgeSessionOf({
        of: 'judging',
        round: JudgingRound.of({ runId: RUN, rubricVersion, attempt: 1 }),
      }).key;

    expect(keyOn(NEXT_RUBRIC_VERSION)).not.toBe(keyOn(RUBRIC_VERSION));
  });

  it('reads back every round from the session it named', () => {
    const judging = {
      of: 'judging' as const,
      round: JudgingRound.of({
        runId: RUN,
        rubricVersion: RUBRIC_VERSION,
        attempt: 3,
      }),
    };
    const candidate = {
      of: 'candidate' as const,
      round: REVISION,
      candidate: 1,
      runId: RunId.of('run:odd/id'),
    };
    const change = {
      of: 'change' as const,
      round: { runId: RUN, judging: 2, attempt: 1 },
    };
    const pair = {
      runId: RUN,
      otherRunId: RunId.of('run_2'),
      attempt: 1,
    };

    expect(judgeRoundOf(settled(judgeSessionOf(judging)))).toEqual(judging);
    expect(judgeRoundOf(settled(judgeSessionOf(candidate)))).toEqual(candidate);
    expect(judgeRoundOf(settled(judgeSessionOf(change)))).toEqual(change);
    expect(pairRoundOf(settled(pairSessionOf(pair, 'other-first')))).toEqual(
      pair,
    );
    expect(
      draftingRoundOf(settled(draftingSessionOf(REVISION, RUN)))?.equals(
        REVISION,
      ),
    ).toBe(true);
  });

  it('bases the drafting session on the run it drafts from', () => {
    expect(draftingSessionOf(REVISION, RUN)).toEqual({
      purpose: 'insights.claims',
      key: 'claims-revision:revision_1:2',
      basedOnRun: 'run_1',
    });
  });

  it.each([
    { purpose: 'change-review.change-stack', key: 'judging:run_1:x:1' },
    { purpose: 'insights.judge', key: 'judging:run_1:not-a-version:1' },
    { purpose: 'insights.judge', key: `judging:run_1:${RUBRIC_VERSION}:0` },
    { purpose: 'insights.judge', key: '%E0%A4%A' },
    { purpose: 'insights.pair-judge', key: 'pair-judging:a:b:1:sideways' },
    { purpose: 'insights.claims', key: 'claims-revision:revision_1' },
  ])('reads no round from a session it did not name: $key', (session) => {
    const read = settled(session);

    expect(judgeRoundOf(read)).toBeNull();
    expect(pairRoundOf(read)).toBeNull();
    expect(draftingRoundOf(read)).toBeNull();
  });
});
