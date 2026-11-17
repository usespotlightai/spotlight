import {
  judgesRunThatEnded,
  sampledForJudging,
} from '@insights/domain/services/judge-sampling';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const runs = Array.from({ length: 2_000 }, (_, at) => RunId.of(`run_${at}`));

const shareOf = (picked: (runId: RunId) => boolean): number =>
  runs.filter(picked).length / runs.length;

describe('judge sampling', () => {
  it('picks the same runs every time it is called', () => {
    expect(runs.map((each) => sampledForJudging(each, 0.3))).toEqual(
      runs.map((each) => sampledForJudging(each, 0.3)),
    );
  });

  it('picks close to the station’s share of runs', () => {
    expect(shareOf((each) => sampledForJudging(each, 0.3))).toBeCloseTo(0.3, 1);
  });

  it('judges every run at a share of 1 and none at 0', () => {
    expect(shareOf((each) => sampledForJudging(each, 1))).toBe(1);
    expect(shareOf((each) => sampledForJudging(each, 0))).toBe(0);
  });

  it('keeps a run picked as its share grows', () => {
    expect(
      runs
        .filter((each) => sampledForJudging(each, 0.2))
        .every((each) => sampledForJudging(each, 0.5)),
    ).toBe(true);
  });

  it.each([
    ['completed', true],
    ['stopped', true],
    ['failed', false],
    ['exhausted', false],
    ['superseded', false],
    ['cancelled', false],
  ] as const)('judges a run that ended %s: %s', (ending, judged) => {
    expect(judgesRunThatEnded(ending)).toBe(judged);
  });
});
