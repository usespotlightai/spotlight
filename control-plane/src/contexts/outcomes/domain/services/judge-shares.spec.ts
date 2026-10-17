import { judgeScore } from '@outcomes/domain/judging.fake-spec';
import { endedRecord } from '@outcomes/domain/outcomes.fake-spec';
import {
  judgeChangeOf,
  judgedByRun,
  judgedRunsOf,
  judgeShareFrom,
  rubricsOf,
  shareOf,
} from '@outcomes/domain/services/judge-shares';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { describe, expect, it } from 'vitest';

describe('shareOf', () => {
  it('puts a yes or no and a one-to-five score on one scale from 0 to 1', () => {
    expect(shareOf(ScoreScale.yesNo(), 1)).toBe(1);
    expect(shareOf(ScoreScale.yesNo(), 0)).toBe(0);
    expect(shareOf(ScoreScale.oneToFive(), 1)).toBe(0);
    expect(shareOf(ScoreScale.oneToFive(), 4)).toBe(0.75);
  });
});

describe('judgeShareFrom', () => {
  const rubrics = rubricsOf(
    [endedRecord('run_1'), endedRecord('run_2'), endedRecord('run_3')],
    judgedByRun([
      { runId: 'run_1', rubricVersion: 'rubric_2', share: 1 },
      { runId: 'run_2', rubricVersion: 'rubric_2', share: 0.5 },
      { runId: 'run_1', rubricVersion: 'rubric_1', share: 0 },
      { runId: 'run_9', rubricVersion: 'rubric_2', share: 0 },
    ]),
  );

  it('averages the shares of the trusted rubric over the runs it has', () => {
    expect(judgeShareFrom(rubrics, 'rubric_2')).toEqual({
      mean: 0.75,
      judged: 2,
    });
  });

  it('says so where the trusted rubric judged none of its runs', () => {
    expect(judgeShareFrom(rubrics, 'rubric_3')).toEqual({
      mean: null,
      judged: 0,
    });
    expect(judgeShareFrom(rubrics, null)).toEqual({ mean: null, judged: 0 });
  });
});

describe('judgeChangeOf', () => {
  it('moves the mean score by percentage points, good when it rose', () => {
    const change = judgeChangeOf(
      { mean: 0.5, judged: 4 },
      { mean: 0.75, judged: 3 },
    );

    expect(change).toMatchObject({
      unit: 'points',
      direction: 'up',
      tone: 'good',
    });
    expect(change?.by).toBeCloseTo(0.25);
  });

  it('has no change where either side went unjudged', () => {
    expect(judgeChangeOf(null, { mean: 0.75, judged: 3 })).toBeNull();
    expect(
      judgeChangeOf({ mean: null, judged: 0 }, { mean: 0.75, judged: 3 }),
    ).toBeNull();
  });
});

describe('judgedRunsOf', () => {
  it('takes only the judge’s scores at the requested station', () => {
    const at = (stationId: string, runId: string) =>
      judgeScore(runId, ScoreScale.yesNo(), 1, { stationId });

    expect(
      judgedRunsOf(
        [at('station_1', 'run_1'), at('station_2', 'run_2')],
        'station_1',
      ).map((each) => each.runId),
    ).toEqual(['run_1']);
  });
});
