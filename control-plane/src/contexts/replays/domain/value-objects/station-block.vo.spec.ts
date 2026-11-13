import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { describe, expect, it } from 'vitest';

const LIVE = StationBlock.of({
  key: 'code-review',
  name: 'Code Review',
  color: '#56b98d',
  judge: { rubric: 'scores: yes-no', sample: 0.2 },
  effort: 'high',
});

describe('StationBlock.overlaidWith', () => {
  it('keeps every field the overlay leaves out', () => {
    expect(LIVE.overlaidWith({ model: 'claude-haiku-5-5' })).toEqual({
      ...LIVE.value,
      model: 'claude-haiku-5-5',
    });
  });

  it('replaces a written field as a whole', () => {
    expect(LIVE.overlaidWith({ judge: { sample: 0.5 } }).judge).toEqual({
      sample: 0.5,
    });
  });

  it('removes a field the overlay sets to null', () => {
    expect(LIVE.overlaidWith({ effort: null })).not.toHaveProperty('effort');
  });
});
