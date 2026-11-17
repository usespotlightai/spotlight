import {
  MAX_SEEN_CHARS,
  Score,
} from '@insights/domain/aggregates/score.aggregate';
import type { ScoreRecorded } from '@insights/domain/events/score-recorded.event';
import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';
import { Citation } from '@insights/domain/value-objects/citation.vo';
import { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import {
  judgeScore,
  locationOf,
  RUBRIC_VERSION,
} from '@insights/judging.fake-spec';
import { WORKSPACE } from '@insights/runs.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const LATER = new Date('2026-09-30T12:00:00.000Z');

const judged = (over: Partial<Parameters<typeof Score.judge>[0]> = {}) =>
  Score.judge({
    id: ScoreId.of('score_1'),
    runId: RunId.of('run_1'),
    workspaceId: WORKSPACE,
    location: locationOf(),
    fingerprint: null,
    claimResults: [true],
    passThreshold: 1,
    rubricVersion: RUBRIC_VERSION,
    model: 'some/model',
    reasons: [
      JudgeReason.of({
        text: 'It retries.',
        citations: [Citation.ofStep(1)],
        claim: 0,
      }),
    ],
    seen: SeenEvidence.none(),
    at: LATER,
    ...over,
  });

describe('Score', () => {
  it('from the judge names its rubric and model, and says it was recorded', () => {
    const score = judgeScore('run_1', [true]);
    const [event] = score.pullEvents() as ScoreRecorded[];

    expect(score.rubricVersion).toBe(RUBRIC_VERSION);
    expect(event?.kind).toBe('score.recorded');
  });

  it('is the share of claims met, marked one by one', () => {
    const score = judgeScore('run_1', [true, false, true, true]);

    expect(score.value).toBe(0.75);
    expect(score.claimResults).toEqual([true, false, true, true]);
  });

  it('passes when the share of claims met reaches its pass threshold', () => {
    expect(judgeScore('run_1', [true, true]).passes).toBe(true);
    expect(judgeScore('run_1', [true, false]).passes).toBe(false);
    expect(
      judgeScore('run_1', [true, false], { passThreshold: 0.5 }).passes,
    ).toBe(true);
    expect(
      judgeScore('run_1', [true, false, false], { passThreshold: 1 / 3 })
        .passes,
    ).toBe(true);
  });

  it('marks at least one claim, and has a pass threshold from 0 to 1', () => {
    expect(() => judgeScore('run_1', [])).toThrow(InvalidScoreError);
    expect(() => judgeScore('run_1', [true], { passThreshold: 1.5 })).toThrow(
      InvalidScoreError,
    );
  });

  it('from the judge always gives its reasons', () => {
    expect(() => judged({ reasons: [] })).toThrow(InvalidScoreError);
  });

  it('from the judge gives a reason for every claim, each naming its claim', () => {
    expect(() => judged({ claimResults: [true, false] })).toThrow(
      InvalidScoreError,
    );
    expect(() =>
      judged({
        reasons: [
          JudgeReason.of({
            text: 'It retries.',
            citations: [Citation.ofStep(1)],
          }),
        ],
      }),
    ).toThrow(InvalidScoreError);
  });

  it('from the judge keeps only what its reasons cite, within a budget for the whole score', () => {
    const citations = Array.from({ length: 10 }, (_, at) =>
      Citation.ofHunk(`api/src/big.ts#${at}`),
    );
    const score = judged({
      reasons: Array.from({ length: 5 }, (_, at) =>
        JudgeReason.of({ text: `Reason ${at}.`, citations, claim: 0 }),
      ),
      seen: SeenEvidence.of({
        steps: [{ index: 9, kind: 'message', tool: null, text: 'Uncited.' }],
        hunks: Array.from({ length: 12 }, (_, at) => ({
          id: `api/src/big.ts#${at}`,
          path: 'api/src/big.ts',
          header: '@@ -1 +1 @@',
          lines: Array.from({ length: 20 }, () => `+${'x'.repeat(400)}`),
        })),
      }),
    });

    expect(score.seen.steps).toEqual([]);
    expect(score.seen.hunks.length).toBeLessThanOrEqual(10);
    expect(score.seen.size).toBeLessThanOrEqual(MAX_SEEN_CHARS);
  });

  it('from the judge always names its model', () => {
    expect(() => judged({ model: ' ' })).toThrow(InvalidScoreError);
  });
});
