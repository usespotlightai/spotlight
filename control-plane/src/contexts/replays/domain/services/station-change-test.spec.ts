import { completedFrom } from '@replays/domain/services/station-change-test';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { describe, expect, it } from 'vitest';

const LIVE = StationBlock.of({
  key: 'code-review',
  name: 'Code Review',
  kind: 'work',
  color: '#56b98d',
  judge: { rubric: 'scores: yes-no', sample: 0.2 },
  passesTo: ['spec', 'implementation'],
  prompt: 'Review the change.',
});

describe('completedFrom', () => {
  it('takes every field the change leaves out from the seed', () => {
    expect(completedFrom(LIVE, { model: 'claude-haiku-5-5' })).toEqual({
      ...LIVE.value,
      model: 'claude-haiku-5-5',
    });
  });

  it('keeps the fields the change writes, so a changed judge still shows', () => {
    expect(
      completedFrom(LIVE, { judge: { rubric: 'other', sample: 0.2 } }),
    ).toMatchObject({
      judge: { rubric: 'other', sample: 0.2 },
    });
  });

  it('leaves a change that is not a block for validation to refuse', () => {
    expect(completedFrom(LIVE, 'not json')).toBe('not json');
    expect(completedFrom(LIVE, ['model'])).toEqual(['model']);
  });
});
