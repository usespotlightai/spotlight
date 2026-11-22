import { MIN_PAIRS } from '@insights/domain/services/judge-calibration';
import {
  calibrationIn,
  judgeReportOf,
} from '@insights/domain/services/judge-report';
import { PersonAction } from '@insights/domain/value-objects/person-action.vo';
import {
  judgeScore,
  NEXT_RUBRIC_VERSION,
  RUBRIC_VERSION,
  rubricOf,
} from '@insights/judging.fake-spec';
import { endedRecord, factsWith } from '@insights/runs.fake-spec';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-09-30T11:00:00.000Z');

const runs = (count: number, agreeing: number) =>
  Array.from({ length: count }, (_, at) => {
    const runId = `run_${at}`;
    const passes = at % 2 === 1;
    const agrees = at < agreeing;

    return {
      score: judgeScore(runId, [passes]),
      record: endedRecord(runId, { taskId: `task_${runId}` }).recordAction(
        PersonAction.of(
          passes === agrees ? 'accepted' : 'sent-back',
          AT,
          UserId.of('user_actor'),
        ),
      ),
    };
  });

const reportOf = (count: number, agreeing: number) => {
  const judgedRuns = runs(count, agreeing);
  const records = judgedRuns.map((each) => each.record);

  return judgeReportOf({
    judged: judgedRuns.map((each) => each.score),
    facts: factsWith(records),
    covering: factsWith(records),
  });
};

const CURRENT = {
  rubricVersion: RUBRIC_VERSION,
  rubric: rubricOf(),
  minAgreement: 0.6,
};

describe('judgeReportOf', () => {
  it('pairs each judge verdict with what people did on the run', () => {
    const report = reportOf(12, 12);
    const [version] = report.versions;

    expect(version?.agreement.pairs).toBe(12);
    expect(version?.agreement.kappa).toBe(1);
    expect(report.coverage).toMatchObject({ runs: 12, both: 12 });
  });

  it('reports each rubric version apart, the latest first', () => {
    const report = judgeReportOf({
      judged: [
        judgeScore('run_1', [true], {
          at: new Date('2026-09-29T10:00:00Z'),
        }),
        judgeScore('run_2', [false], {
          rubricVersion: NEXT_RUBRIC_VERSION,
          at: new Date('2026-09-30T10:00:00Z'),
        }),
      ],
      facts: [],
      covering: [],
    });

    expect(report.versions.map((each) => each.rubricVersion)).toEqual([
      NEXT_RUBRIC_VERSION,
      RUBRIC_VERSION,
    ]);
  });
});

describe('calibrationIn', () => {
  it('qualifies a judge that agrees with people as often as the station requests', () => {
    expect(calibrationIn(reportOf(12, 12), CURRENT)).toMatchObject({
      qualified: true,
      hiddenReason: null,
    });
  });

  it('hides the scores of a judge that agrees too seldom', () => {
    expect(calibrationIn(reportOf(12, 6), CURRENT)).toMatchObject({
      qualified: false,
      hiddenReason: 'below-min-agreement',
    });
  });

  it('hides the scores until enough runs have both', () => {
    expect(calibrationIn(reportOf(MIN_PAIRS - 1, 9), CURRENT)).toMatchObject({
      qualified: false,
      hiddenReason: 'too-few-pairs',
    });
  });

  it('counts only the station’s current rubric', () => {
    expect(
      calibrationIn(reportOf(12, 12), {
        ...CURRENT,
        rubricVersion: NEXT_RUBRIC_VERSION,
      }),
    ).toMatchObject({
      qualified: false,
      pairs: 0,
      hiddenReason: 'too-few-pairs',
    });
  });

  it('says a station without a judge has none to qualify', () => {
    expect(calibrationIn(reportOf(12, 12), null).hiddenReason).toBe('no-judge');
  });
});

describe('calibrationIn, for a rubric it cannot read', () => {
  it('hides the scores and says the rubric cannot be read', () => {
    expect(
      calibrationIn(reportOf(12, 12), { ...CURRENT, rubric: null }),
    ).toMatchObject({ qualified: false, hiddenReason: 'unreadable-rubric' });
  });
});
