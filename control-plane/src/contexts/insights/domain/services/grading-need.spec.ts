import {
  FREE_LABEL_COVERAGE_MIN,
  freeLabelCoverageOf,
  GRADING_WINDOW_MS,
  needsGrades,
} from '@insights/domain/services/grading-need';
import { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import { judgeScore } from '@insights/judging.fake-spec';
import { endedRecord, factsWith, scoreFactOf } from '@insights/runs.fake-spec';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-30T10:00:00.000Z');

const RECENT = new Date('2026-10-29T10:00:00.000Z');

const judged = (runId: string, at = RECENT, origin?: 'live' | 'backfill') =>
  scoreFactOf(judgeScore(runId, [true, true, true], { at, origin }));

const accepted = (runId: string) =>
  endedRecord(runId).recordAction(HumanAction.of('accepted', RECENT));

describe('freeLabelCoverageOf', () => {
  it('gives the share of recently judged runs that people acted on', () => {
    const facts = factsWith([accepted('run_1'), endedRecord('run_2')]);

    expect(
      freeLabelCoverageOf({
        judged: [judged('run_1'), judged('run_2')],
        facts,
        now: NOW,
      }),
    ).toBe(0.5);
  });

  it('leaves out runs judged before the window', () => {
    const old = new Date(NOW.getTime() - GRADING_WINDOW_MS - 1);

    expect(
      freeLabelCoverageOf({
        judged: [judged('run_1'), judged('run_2', old)],
        facts: factsWith([accepted('run_1')]),
        now: NOW,
      }),
    ).toBe(1);
  });

  it('leaves out backfill scores, which only judge runs people acted on', () => {
    expect(
      freeLabelCoverageOf({
        judged: [judged('run_1'), judged('run_2', RECENT, 'backfill')],
        facts: factsWith([endedRecord('run_1'), accepted('run_2')]),
        now: NOW,
      }),
    ).toBe(0);
  });

  it('knows nothing when no run was judged in the window', () => {
    expect(freeLabelCoverageOf({ judged: [], facts: [], now: NOW })).toBeNull();
  });
});

describe('needsGrades', () => {
  it.each([
    [null, true],
    [0, true],
    [FREE_LABEL_COVERAGE_MIN - 0.01, true],
    [FREE_LABEL_COVERAGE_MIN, false],
    [1, false],
  ])('with coverage %s asks for grades: %s', (coverage, asks) => {
    expect(needsGrades(coverage)).toBe(asks);
  });
});
