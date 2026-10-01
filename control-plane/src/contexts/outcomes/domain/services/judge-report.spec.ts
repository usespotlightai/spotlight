import {
  judgeScore,
  NEXT_RUBRIC_VERSION,
  personGrade,
  RUBRIC_VERSION,
} from '@outcomes/domain/judging.fake-spec';
import { endedRecord } from '@outcomes/domain/outcomes.fake-spec';
import {
  judgeReportOf,
  standingIn,
} from '@outcomes/domain/services/judge-report';
import { FEWEST_PAIRS } from '@outcomes/domain/services/judge-standing';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { describe, expect, it } from 'vitest';

const YES_NO = ScoreScale.yesNo();
const AT = new Date('2026-09-30T11:00:00.000Z');

const runs = (count: number, agreeing: number) =>
  Array.from({ length: count }, (_, at) => {
    const runId = `run_${at}`;
    const judged = at % 2;
    const agrees = at < agreeing;

    return {
      score: judgeScore(runId, YES_NO, judged),
      record: endedRecord(runId, { taskId: `task_${runId}` }).actedOn(
        NextAct.of((judged === 1) === agrees ? 'approved' : 'sent-back', AT),
      ),
    };
  });

const reportOf = (count: number, agreeing: number) => {
  const held = runs(count, agreeing);
  const records = held.map((each) => each.record);

  return judgeReportOf({
    judged: held.map((each) => each.score),
    grades: [],
    records,
    covering: records,
    deliveries: [],
  });
};

const CURRENT = { rubricVersion: RUBRIC_VERSION, scale: YES_NO, trust: 0.6 };

describe('judgeReportOf', () => {
  it('pairs each judge score with what people did on the run', () => {
    const report = reportOf(12, 12);
    const [version] = report.versions;

    expect(version?.agreement.pairs).toBe(12);
    expect(version?.agreement.kappa).toBe(1);
    expect(report.coverage).toMatchObject({ runs: 12, both: 12 });
  });

  it('lets a person’s grade stand for the run instead of what they did', () => {
    const report = judgeReportOf({
      judged: [judgeScore('run_1', YES_NO, 1)],
      grades: [personGrade('run_1', YES_NO, 0)],
      records: [
        endedRecord('run_1', { taskId: 'task_run_1' }).actedOn(
          NextAct.of('approved', AT),
        ),
      ],
      covering: [],
      deliveries: [],
    });

    expect(report.versions[0]?.agreement.confusion.cells).toEqual([
      [0, 0],
      [1, 0],
    ]);
  });

  it('reports each rubric version apart, the latest first', () => {
    const report = judgeReportOf({
      judged: [
        judgeScore('run_1', YES_NO, 1, {
          at: new Date('2026-09-29T10:00:00Z'),
        }),
        judgeScore('run_2', YES_NO, 0, {
          rubricVersion: NEXT_RUBRIC_VERSION,
          at: new Date('2026-09-30T10:00:00Z'),
        }),
      ],
      grades: [],
      records: [],
      covering: [],
      deliveries: [],
    });

    expect(report.versions.map((each) => each.rubricVersion)).toEqual([
      NEXT_RUBRIC_VERSION,
      RUBRIC_VERSION,
    ]);
  });
});

describe('standingIn', () => {
  it('trusts a judge that agrees with people as often as the station asks', () => {
    expect(standingIn(reportOf(12, 12), CURRENT)).toMatchObject({
      trusted: true,
      measure: 'kappa',
      hiddenBecause: null,
    });
  });

  it('hides the scores of a judge that agrees too seldom', () => {
    expect(standingIn(reportOf(12, 6), CURRENT)).toMatchObject({
      trusted: false,
      hiddenBecause: 'below-trust',
    });
  });

  it('hides the scores until enough runs have both', () => {
    expect(standingIn(reportOf(FEWEST_PAIRS - 1, 9), CURRENT)).toMatchObject({
      trusted: false,
      hiddenBecause: 'too-few-pairs',
    });
  });

  it('counts only the station’s current rubric', () => {
    expect(
      standingIn(reportOf(12, 12), {
        ...CURRENT,
        rubricVersion: NEXT_RUBRIC_VERSION,
      }),
    ).toMatchObject({
      trusted: false,
      pairs: 0,
      hiddenBecause: 'too-few-pairs',
    });
  });

  it('says a station without a judge has none to trust', () => {
    expect(standingIn(reportOf(12, 12), null).hiddenBecause).toBe('no-judge');
  });
});

describe('standingIn, for a rubric it cannot read', () => {
  it('hides the scores and says the rubric cannot be read', () => {
    expect(
      standingIn(reportOf(12, 12), { ...CURRENT, scale: null }),
    ).toMatchObject({ trusted: false, hiddenBecause: 'unreadable-rubric' });
  });
});
