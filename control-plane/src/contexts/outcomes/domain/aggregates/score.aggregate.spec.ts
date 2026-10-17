import {
  MAX_SEEN_KEPT,
  Score,
} from '@outcomes/domain/aggregates/score.aggregate';
import type { ScoreRecorded } from '@outcomes/domain/events/score-recorded.event';
import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import {
  judgeScore,
  personGrade,
  placeOf,
  RUBRIC_VERSION,
} from '@outcomes/domain/judging.fake-spec';
import { WORKSPACE } from '@outcomes/domain/outcomes.fake-spec';
import { Citation } from '@outcomes/domain/value-objects/citation.vo';
import { JudgeReason } from '@outcomes/domain/value-objects/judge-reason.vo';
import { ScoreId } from '@outcomes/domain/value-objects/score-id.vo';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { SeenEvidence } from '@outcomes/domain/value-objects/seen-evidence.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const LATER = new Date('2026-09-30T12:00:00.000Z');

describe('Score', () => {
  it('from the judge names its rubric and model, and says it was recorded', () => {
    const score = judgeScore('run_1', ScoreScale.yesNo(), 1);
    const [event] = score.pullEvents() as ScoreRecorded[];

    expect(score.fromJudge).toBe(true);
    expect(score.rubricVersion).toBe(RUBRIC_VERSION);
    expect(event?.source).toBe('judge');
  });

  it('from the judge always gives its reasons', () => {
    expect(() =>
      Score.judge({
        id: ScoreId.of('score_1'),
        runId: RunId.of('run_1'),
        workspaceId: WORKSPACE,
        place: placeOf(),
        fingerprint: null,
        scale: ScoreScale.yesNo(),
        value: 1,
        marks: null,
        rubricVersion: RUBRIC_VERSION,
        model: 'some/model',
        reasons: [],
        seen: SeenEvidence.none(),
        at: LATER,
      }),
    ).toThrow(InvalidScoreError);
  });

  it('from the judge keeps only what its reasons cite, within a budget for the whole score', () => {
    const citations = Array.from({ length: 10 }, (_, at) =>
      Citation.ofHunk(`api/src/big.ts#${at}`),
    );
    const score = Score.judge({
      id: ScoreId.of('score_1'),
      runId: RunId.of('run_1'),
      workspaceId: WORKSPACE,
      place: placeOf(),
      fingerprint: null,
      scale: ScoreScale.yesNo(),
      value: 1,
      marks: null,
      rubricVersion: RUBRIC_VERSION,
      model: 'some/model',
      reasons: Array.from({ length: 5 }, (_, at) =>
        JudgeReason.of({ text: `Reason ${at}.`, citations }),
      ),
      seen: SeenEvidence.of({
        steps: [{ index: 9, kind: 'said', tool: null, text: 'Uncited.' }],
        hunks: Array.from({ length: 12 }, (_, at) => ({
          id: `api/src/big.ts#${at}`,
          path: 'api/src/big.ts',
          header: '@@ -1 +1 @@',
          lines: Array.from({ length: 20 }, () => `+${'x'.repeat(400)}`),
        })),
      }),
      at: LATER,
    });

    expect(score.seen.steps).toEqual([]);
    expect(score.seen.hunks.length).toBeLessThanOrEqual(10);
    expect(score.seen.size).toBeLessThanOrEqual(MAX_SEEN_KEPT);
  });

  it('from a person keeps nothing the judge saw', () => {
    expect(() =>
      Score.rehydrate({
        id: ScoreId.of('grade_1'),
        runId: RunId.of('run_1'),
        workspaceId: WORKSPACE,
        place: placeOf(),
        fingerprint: null,
        source: 'person',
        scale: ScoreScale.yesNo(),
        value: 1,
        marks: null,
        rubricVersion: null,
        model: null,
        reasons: [],
        seen: SeenEvidence.of({
          steps: [{ index: 1, kind: 'said', tool: null, text: 'Seen.' }],
          hunks: [],
        }),
        by: personGrade('run_1', ScoreScale.yesNo(), 1).by,
        at: LATER,
        version: 0,
      }),
    ).toThrow(InvalidScoreError);
  });

  it('stays on its scale', () => {
    expect(() => judgeScore('run_1', ScoreScale.yesNo(), 3)).toThrow(
      InvalidScoreError,
    );
  });

  it('from a person is replaced by their later grade', () => {
    const grade = personGrade('run_1', ScoreScale.yesNo(), 1);
    grade.pullEvents();

    const regraded = grade.regrade({
      scale: ScoreScale.yesNo(),
      value: 0,
      marks: null,
      rubricVersion: RUBRIC_VERSION,
      at: LATER,
    });

    expect(regraded.value).toBe(0);
    expect(regraded.at).toEqual(LATER);
    expect(regraded.id.equals(grade.id)).toBe(true);
    expect(regraded.pullEvents()).toHaveLength(1);
  });

  it('from a person stays as it is when graded the same again', () => {
    const grade = personGrade('run_1', ScoreScale.yesNo(), 1);

    expect(
      grade.regrade({
        scale: ScoreScale.yesNo(),
        value: 1,
        marks: null,
        rubricVersion: RUBRIC_VERSION,
        at: LATER,
      }),
    ).toBe(grade);
  });

  it('from the judge is never graded again', () => {
    expect(() =>
      judgeScore('run_1', ScoreScale.yesNo(), 1).regrade({
        scale: ScoreScale.yesNo(),
        value: 0,
        marks: null,
        rubricVersion: RUBRIC_VERSION,
        at: LATER,
      }),
    ).toThrow(InvalidScoreError);
  });

  it('on a claims scale is the share of claims met, marked one by one', () => {
    const score = judgeScore('run_1', ScoreScale.claims(), 0, {
      marks: [true, false, true, true],
    });

    expect(score.value).toBe(0.75);
    expect(score.marks).toEqual([true, false, true, true]);
    expect(score.scale.labelOf(score.value)).toBe('75% of claims met');
  });

  it('on a claims scale from the judge gives a reason for every claim, each naming its claim', () => {
    expect(() =>
      Score.judge({
        id: ScoreId.of('score_1'),
        runId: RunId.of('run_1'),
        workspaceId: WORKSPACE,
        place: placeOf(),
        fingerprint: null,
        scale: ScoreScale.claims(),
        value: 0.5,
        marks: [true, false],
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
      }),
    ).toThrow(InvalidScoreError);
  });

  it('on a claims scale has a value that is the share its marks give, and marks only there', () => {
    expect(() =>
      personGrade('run_1', ScoreScale.claims(), 0).regrade({
        scale: ScoreScale.claims(),
        value: 1,
        marks: [true, false],
        rubricVersion: RUBRIC_VERSION,
        at: LATER,
      }),
    ).toThrow(InvalidScoreError);
    expect(() =>
      personGrade('run_1', ScoreScale.yesNo(), 1, { marks: [true] }),
    ).toThrow(InvalidScoreError);
    expect(() => personGrade('run_1', ScoreScale.claims(), 1)).toThrow(
      InvalidScoreError,
    );
  });

  it('from a person on a claims scale is regraded claim by claim', () => {
    const grade = personGrade('run_1', ScoreScale.claims(), 0, {
      marks: [true, true],
    });

    const regraded = grade.regrade({
      scale: ScoreScale.claims(),
      value: 0.5,
      marks: [true, false],
      rubricVersion: RUBRIC_VERSION,
      at: LATER,
    });

    expect(regraded.marks).toEqual([true, false]);
    expect(regraded.value).toBe(0.5);
  });
});
