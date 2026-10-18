import { scoredLive } from '@replays/domain/services/live-scoring';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { describe, expect, it } from 'vitest';

const LIVE = StationBlock.of({
  key: 'build',
  name: 'Build',
  prompt: 'Build it.',
  check: 'npm test',
  diffs: true,
});

describe('scoredLive', () => {
  it('keeps the plan’s other changes and scores it with the live check, judge and diffs', () => {
    const scored = scoredLive(
      {
        key: 'build',
        name: 'Build',
        prompt: 'Build it carefully.',
        check: 'true',
        judge: {
          rubric: 'scores: yes-no\nAll good?',
          sample: 1,
          minAgreement: 0,
        },
        diffs: false,
      },
      LIVE,
    );

    expect(scored.block).toEqual({
      key: 'build',
      name: 'Build',
      prompt: 'Build it carefully.',
      check: 'npm test',
      diffs: true,
    });
    expect(scored.scoringPinnedToLive).toEqual(['check', 'judge', 'diffs']);
  });

  it('says nothing was pinned to live when the plan scores as the live station does', () => {
    expect(
      scoredLive(
        { key: 'build', name: 'Build', prompt: 'Other.', check: 'npm test' },
        LIVE,
      ).scoringPinnedToLive,
    ).toEqual([]);
  });

  it('counts a check the plan drops as pinned to live, but not diffs it leaves for Spotlight to derive', () => {
    expect(
      scoredLive({ key: 'build', name: 'Build', prompt: 'Other.' }, LIVE),
    ).toEqual({
      block: {
        key: 'build',
        name: 'Build',
        prompt: 'Other.',
        check: 'npm test',
        diffs: true,
      },
      scoringPinnedToLive: ['check'],
    });
  });

  it('leaves what is not a station block for validation to reject', () => {
    expect(scoredLive('nonsense', LIVE)).toEqual({
      block: 'nonsense',
      scoringPinnedToLive: [],
    });
  });
});
